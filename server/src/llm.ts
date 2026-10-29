import { config } from './config.ts'
import { aiAllowed } from './guard.ts'
import { budgetStatus, countLiveCall, liveAllowed, noteFailure, record, replay } from './replay.ts'

/** The four Nemotron roles Haltwise uses. Exact IDs are resolved from Token Factory's /models at startup. */
export type Role = 'super' | 'nano' | 'omni' | 'ultra'

const DEFAULTS: Record<Role, string> = {
  super: 'nvidia/nemotron-3-super-120b-a12b',
  nano: 'nvidia/nemotron-3-nano-30b-a3b',
  omni: 'nvidia/nemotron-3-nano-omni',
  ultra: 'nvidia/nemotron-3-ultra',
}

const MATCHERS: Record<Role, RegExp> = {
  super: /nemotron-3-super/i,
  ultra: /nemotron-3-ultra/i,
  omni: /nemotron.*omni/i,
  nano: /nemotron-3-nano(?!.*omni)/i,
}

export const models: Record<Role, string> = { ...DEFAULTS }
export const available: Record<Role, boolean> = { super: false, nano: false, omni: false, ultra: false }
export let catalog: string[] = []

/** When a role is missing on the account, fall back down this chain (logged in the trace). */
const FALLBACK: Record<Role, Role[]> = {
  ultra: ['super', 'nano'],
  super: ['nano'],
  nano: ['super'],
  omni: [],
}

export async function resolveModels() {
  for (const r of Object.keys(models) as Role[]) {
    const o = config.modelOverrides[r]
    if (o) models[r] = o
  }
  if (!config.nebiusKey) {
    console.warn('[llm] NEBIUS_API_KEY missing: every agent will use its deterministic fallback')
    return { catalog, models, available }
  }
  try {
    const res = await fetch(config.nebiusBase + 'models', {
      headers: { Authorization: `Bearer ${config.nebiusKey}` },
      signal: AbortSignal.timeout(15000),
    })
    const body = (await res.json()) as { data?: { id: string }[] }
    catalog = (body.data ?? []).map(m => m.id)
    for (const r of Object.keys(models) as Role[]) {
      if (config.modelOverrides[r]) {
        available[r] = catalog.includes(models[r])
        continue
      }
      // Prefer instruct/chat variants over base checkpoints when several match.
      const hits = catalog.filter(id => MATCHERS[r].test(id)).sort((a, b) => scoreId(b) - scoreId(a))
      if (hits[0]) {
        models[r] = hits[0]
        available[r] = true
      }
    }
    console.log('[llm] Nemotron models on Token Factory:', catalog.filter(id => /nemotron/i.test(id)))
    console.log('[llm] resolved roles:', models, 'available:', available)
  } catch (e) {
    console.warn('[llm] could not list models:', (e as Error).message)
  }
  return { catalog, models, available }
}

const scoreId = (id: string) => (/instruct|chat|-it\b/i.test(id) ? 2 : 0) + (/fp8|nvfp4/i.test(id) ? 0 : 1) - (/base/i.test(id) ? 3 : 0)

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatOpts {
  role: Role
  system: string
  user: string | ContentPart[]
  json?: boolean
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  /** Benchmarks need the exact model: skip the fallback chain. */
  noFallback?: boolean
}

export interface ChatResult {
  ok: boolean
  text: string
  json?: any
  model: string
  role: Role
  ms: number
  error?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  /** Models tried before this one in the fallback chain, with why they failed. */
  failed?: { model: string; error?: string }[]
  /** True when a hedged call's backup model answered first. */
  hedged?: boolean
  /** True when this is a recorded Nemotron answer served because a live call wasn't possible (see replay.ts). */
  replayed?: boolean
}

const TIMEOUTS: Record<Role, number> = { nano: 15000, omni: 30000, super: 35000, ultra: 90000 }

/**
 * One OpenAI-compatible chat call to Token Factory with timeout, JSON extraction,
 * and model fallback. If no live call is possible (key missing, account paused, spend cap reached), a recorded
 * Nemotron answer for the same input is served, labelled as recorded. Never throws: callers check `ok` and use
 * their own rule-based fallback.
 */
export async function chat(opts: ChatOpts): Promise<ChatResult> {
  if (!aiAllowed()) return { ok: false, text: '', model: 'none', role: opts.role, ms: 0, error: 'watchdog: AI disconnected (level 3 safe mode)' }
  if (config.nemotronMode === 'record') {
    // Same input, same answer while recording, so prompts built on this answer match on replay.
    const seen = replay(opts, extractJson)
    if (seen) return { ...seen, model: seen.model.replace(/ · recorded.*$/, '') }
  }
  const chain: Role[] = opts.noFallback ? [opts.role] : [opts.role, ...FALLBACK[opts.role]]
  let last: ChatResult | undefined
  const failed: { model: string; error?: string }[] = []
  const gate = liveAllowed()
  for (const role of chain) {
    if (!config.nebiusKey || !liveAllowed().ok) break
    if (catalog.length && !available[role] && role !== opts.role) continue
    countLiveCall()
    last = await callOnce(role, opts)
    if (last.ok) {
      record(opts, last)
      return failed.length ? { ...last, failed } : last
    }
    failed.push({ model: last.model, error: last.error })
    noteFailure(last.error)
    console.warn(`[llm] ${last.model} failed: ${last.error}`)
  }
  const recorded = replay(opts, extractJson)
  if (recorded) return failed.length ? { ...recorded, failed } : recorded
  const why = !config.nebiusKey ? 'NEBIUS_API_KEY not set' : gate.ok ? last?.error : gate.why
  return last ? { ...last, failed } : { ok: false, text: '', model: 'none', role: opts.role, ms: 0, error: why }
}

/**
 * Hedged call for paths a customer is waiting on. Starts the primary model; if it hasn't answered after
 * `hedgeAfterMs`, or fails (e.g. HTTP 529 "worker overloaded"), starts the backup as well and returns the
 * first valid answer. Added after Super took 2.2 s on one run and 21.7 s on the next for the same request.
 */
export function chatHedged(opts: ChatOpts & { backup: Role; hedgeAfterMs: number }): Promise<ChatResult> {
  const { backup, hedgeAfterMs, ...base } = opts
  return new Promise(resolve => {
    let settled = false
    let pending = 0
    let backupStarted = false
    const failed: { model: string; error?: string }[] = []
    const finish = (r: ChatResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(r)
    }
    const launch = (role: Role, hedged: boolean) => {
      pending++
      chat({ ...base, role, noFallback: true }).then(r => {
        pending--
        if (r.ok) return finish({ ...r, hedged, failed: failed.length ? failed : undefined })
        failed.push({ model: r.model, error: r.error })
        if (!backupStarted) startBackup()
        else if (pending === 0) finish({ ...r, failed })
      })
    }
    const startBackup = () => {
      if (backupStarted || settled) return
      backupStarted = true
      launch(backup, true)
    }
    const timer = setTimeout(startBackup, hedgeAfterMs)
    launch(base.role, false)
  })
}

async function callOnce(role: Role, opts: ChatOpts, plain = false): Promise<ChatResult> {
  const model = models[role]
  const started = Date.now()
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 900,
    temperature: opts.temperature ?? 0.2,
  }
  if (!plain) {
    if (opts.json) body.response_format = { type: 'json_object' }
    body.chat_template_kwargs = { enable_thinking: config.thinking }
  }
  try {
    const res = await fetch(config.nebiusBase + 'chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.nebiusKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUTS[role]),
    })
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300)
      // Some deployments reject response_format / chat_template_kwargs: retry once without them.
      if (res.status === 400 && !plain) return callOnce(role, opts, true)
      return { ok: false, text: '', model, role, ms: Date.now() - started, error: `HTTP ${res.status}: ${errText}` }
    }
    const data = (await res.json()) as any
    const raw: string = data.choices?.[0]?.message?.content ?? ''
    const finish: string = data.choices?.[0]?.finish_reason ?? '?'
    const text = stripThinking(raw)
    const out: ChatResult = { ok: true, text, model, role, ms: Date.now() - started, usage: data.usage }
    if (opts.json) {
      out.json = extractJson(text)
      if (out.json === undefined) return { ...out, ok: false, error: `no parseable JSON (finish=${finish}, ${text.length} chars: ${text.slice(0, 120)})` }
    }
    return out
  } catch (e) {
    return { ok: false, text: '', model, role, ms: Date.now() - started, error: (e as Error).message }
  }
}

export function stripThinking(s: string) {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim()
}

export function extractJson(s: string): any {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : s
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return undefined
  }
}

export const modelStatus = () => ({ models, available, keySet: !!config.nebiusKey, nemotronCatalog: catalog.filter(id => /nemotron/i.test(id)), nemotron: budgetStatus() })
