import { db, kvGet, kvSet } from '../db.ts'
import { chat } from '../llm.ts'
import { asData } from '../redact.ts'
import type { Run } from '../trace.ts'

interface Report {
  id: number
  channel: string
  category: string
  text: string
  country: string
  indicator: string
  ts: number
}

const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' url ')
      .replace(/[\d.,$£€₹]+/g, ' ')
      .split(/[^\p{L}]+/u)
      .filter(w => w.length > 2),
  )

const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter || 1)
}

export interface Campaign {
  id: string
  name: string
  category: string
  count: number
  windowHours: number
  countries: string[]
  channels: string[]
  sample: string
  firstTs: number
  lastTs: number
  active: boolean
}

/** Scam Radar: cluster recent reports into campaigns (template similarity within a category). */
export function clusterReports(hours = 24): Campaign[] {
  const since = Date.now() - hours * 3600_000
  const rows = db.prepare('SELECT * FROM reports WHERE ts >= ? ORDER BY ts DESC').all(since) as unknown as Report[]
  const clusters: { cat: string; centroid: Set<string>; items: Report[] }[] = []
  for (const r of rows) {
    const tk = tokens(r.text)
    let best: (typeof clusters)[number] | undefined
    let bestSim = 0
    for (const c of clusters) {
      if (c.cat !== r.category) continue
      const sim = jaccard(tk, c.centroid)
      if (sim > bestSim) (bestSim = sim), (best = c)
    }
    if (best && bestSim >= 0.3) best.items.push(r)
    else clusters.push({ cat: r.category, centroid: tk, items: [r] })
  }
  return clusters
    .filter(c => c.items.length >= 3)
    .map(c => {
      const ts = c.items.map(i => i.ts)
      const first = Math.min(...ts)
      const last = Math.max(...ts)
      const id = `${c.cat}:${[...c.centroid].slice(0, 4).join('-')}`
      return {
        id,
        name: kvGet<string>(`campaign-name:${id}`) ?? defaultName(c.cat),
        category: c.cat,
        count: c.items.length,
        windowHours: Math.max(1, Math.round((last - first) / 3600_000)),
        countries: [...new Set(c.items.map(i => i.country))],
        channels: [...new Set(c.items.map(i => i.channel))],
        sample: c.items[0].text,
        firstTs: first,
        lastTs: last,
        active: Date.now() - last < 3 * 3600_000,
      }
    })
    .sort((a, b) => b.count - a.count)
}

const defaultName = (cat: string) =>
  ({
    delivery_toll: 'Fake toll / parcel fee texts',
    safe_account: '"Bank fraud team" safe-account calls',
    job: 'Task-based job scam',
    bank_impersonation: 'Fake bank KYC / account-block texts',
    investment_crypto: 'Crypto investment pitch',
  })[cat] ?? cat.replace(/_/g, ' ')

/** Nano names each new campaign once (cached), in a few words, from the sample text. */
export async function nameCampaigns(run: Run) {
  const list = clusterReports()
  for (const c of list.slice(0, 6)) {
    if (kvGet(`campaign-name:${c.id}`)) continue
    const res = await chat({
      role: 'nano',
      maxTokens: 60,
      timeoutMs: 8000,
      system: 'Name this scam campaign in 3-6 plain English words, no quotes, no brand names. Reply with the name only.',
      user: asData('sample_report', c.sample),
    })
    if (res.ok && res.text) {
      kvSet(`campaign-name:${c.id}`, res.text.replace(/["\n]/g, '').slice(0, 60))
      run.log('radar', `campaign named: ${res.text.slice(0, 60)}`, { model: res.model, ms: res.ms, detail: { count: c.count } })
    }
  }
  return clusterReports()
}

export function addReport(r: { channel: string; category: string; text: string; country: string; indicator?: string }) {
  db.prepare('INSERT INTO reports (channel, category, text, country, indicator, ts) VALUES (?,?,?,?,?,?)').run(r.channel, r.category, r.text.slice(0, 500), r.country, r.indicator ?? 'n/a', Date.now())
}

/** Customer pre-warning: active campaigns in the customer's country with 10+ reports. */
export function alertsFor(country: string) {
  return clusterReports(6).filter(c => c.active && c.count >= 8 && (c.countries.includes(country) || country === 'EU'))
}
