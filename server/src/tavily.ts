import { config } from './config.ts'
import { kvGet, kvSet } from './db.ts'

export interface Source {
  title: string
  url: string
  content: string
}

export interface SearchResult {
  ok: boolean
  sources: Source[]
  ms: number
  cached?: boolean
  error?: string
}

const DAY = 24 * 3600 * 1000

/** Tavily search with timeout and a cache of real past results, so a flaky network never breaks the demo. */
export async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[]; maxResults?: number; depth?: 'basic' | 'advanced'; timeoutMs?: number; preferCacheMs?: number } = {},
): Promise<SearchResult> {
  const key = `tavily:${query}:${(opts.includeDomains ?? []).join(',')}`
  const started = Date.now()
  // Slow-changing lookups (official reporting channels) reuse a recent real result instead of waiting on the network.
  if (opts.preferCacheMs) {
    const fresh = kvGet<Source[]>(key, opts.preferCacheMs)
    if (fresh?.length) return { ok: true, sources: fresh, ms: 0, cached: true }
  }
  if (!config.tavilyKey) {
    const cached = kvGet<Source[]>(key)
    return cached ? { ok: true, sources: cached, ms: 0, cached: true } : { ok: false, sources: [], ms: 0, error: 'TAVILY_API_KEY not set' }
  }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.tavilyKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        search_depth: opts.depth ?? 'basic',
        max_results: opts.maxResults ?? 5,
        include_domains: opts.includeDomains,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = (await res.json()) as { results?: { title: string; url: string; content: string }[] }
    const sources = (data.results ?? []).map(r => ({ title: r.title, url: r.url, content: (r.content ?? '').slice(0, 700) }))
    kvSet(key, sources)
    return { ok: true, sources, ms: Date.now() - started }
  } catch (e) {
    const cached = kvGet<Source[]>(key, 30 * DAY)
    if (cached) return { ok: true, sources: cached, ms: Date.now() - started, cached: true, error: (e as Error).message }
    return { ok: false, sources: [], ms: Date.now() - started, error: (e as Error).message }
  }
}
