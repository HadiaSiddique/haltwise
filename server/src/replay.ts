import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.ts'
import type { ChatOpts, ChatResult, Role } from './llm.ts'

/**
 * Recorded Nemotron answers for the demo flows. They were produced live by Nemotron on Token Factory (NEMOTRON_MODE=record)
 * and are served only when a live call can't be made: Token Factory unreachable, the account paused, or the spend cap reached.
 * Every replayed answer is labelled "recorded" in the trace. Anything not recorded (a judge's own text) falls back to rules.
 */
const FILE = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', 'replay', 'nemotron-replay.json')

interface Entry {
  role: Role
  model: string
  text: string
  at: string
}

let store: Record<string, Entry> = {}
/** Finished outputs whose model input is fresh web content (live alerts): replaying the raw answer against new results would mismatch. */
let snapshots: Record<string, { value: unknown; at: string }> = {}
try {
  const f = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  store = f.answers ?? {}
  snapshots = f.snapshots ?? {}
} catch {
  store = {}
}

/** Prompts carry ids, timestamps and session codes that differ on every run; strip them so the same demo input matches. */
export function normalise(s: string) {
  return s
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z?/g, '<ts>')
    .replace(/\b\d{1,2}:\d\d(:\d\d)?(\s?[AP]M)?/gi, '<time>')
    .replace(/\b[A-Z]{2,5}-[A-Z0-9]{5,}\b/g, '<id>')
    .replace(/\b(cust|sess|call|case|tx)[-_][a-z0-9]{4,}\b/gi, '<id>')
    .replace(/\b\d{9,}\b/g, '<n>')
    .replace(/"(ts|at|time|created_at|updated_at|createdAt|updatedAt|valid_from|valid_to|startedAt|ms)"\s*:\s*[\d.]+/g, '"$1":<n>')
    .replace(/\b\d+ ?ms\b/g, '<n>ms')
    .replace(/\s+/g, ' ')
    .trim()
}

const userText = (u: ChatOpts['user']) => (typeof u === 'string' ? u : u.map(p => (p.type === 'text' ? p.text : '<image>')).join('\n'))
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 20)
const keyOf = (o: ChatOpts) => hash(normalise(o.system) + '\u0000' + normalise(userText(o.user)))

let dirty = false
const save = () => {
  if (dirty) return
  dirty = true
  setTimeout(() => {
    dirty = false
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify({ answers: store, snapshots }))
  }, 1500)
}

/** REPLAY_DEBUG=<dir> writes the normalised prompt of every recorded call and every miss, to see why a demo input didn't match. */
const debug = (name: string, o: ChatOpts) => {
  const dir = process.env.REPLAY_DEBUG
  if (!dir) return
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), normalise(o.system).slice(0, 200) + '\n----\n' + normalise(userText(o.user)))
}

/**
 * First answer wins. A hedged call records both models' answers; the first is the one the app used, and later prompts
 * (a recovery plan built on the facts it extracted) are keyed on it. While recording, an input seen before is answered
 * from the recording too (see chat()), so the whole chain stays consistent on replay.
 */
export function record(o: ChatOpts, r: ChatResult) {
  if (config.nemotronMode !== 'record' || !r.ok || r.replayed || typeof o.user !== 'string') return
  if (store[keyOf(o)]) return
  store[keyOf(o)] = { role: r.role, model: r.model, text: r.text, at: new Date().toISOString() }
  debug(`rec-${keyOf(o)}.txt`, o)
  save()
}

export function recordSnapshot(key: string, value: unknown) {
  if (config.nemotronMode !== 'record') return
  snapshots[key] = { value, at: new Date().toISOString() }
  save()
}

export const snapshot = <T>(key: string) => snapshots[key] as { value: T; at: string } | undefined

export function replay(o: ChatOpts, parse: (text: string) => any): ChatResult | undefined {
  const e = store[keyOf(o)]
  if (!e) {
    debug(`miss-${keyOf(o)}.txt`, o)
    return undefined
  }
  const out: ChatResult = { ok: true, text: e.text, model: `${e.model} · recorded ${e.at.slice(0, 10)}`, role: e.role, ms: 0, replayed: true }
  if (o.json) {
    out.json = parse(e.text)
    if (out.json === undefined) return undefined
  }
  return out
}

export const replayCount = () => Object.keys(store).length + Object.keys(snapshots).length

// --- live-call budget and circuit breaker --------------------------------------------------------------------------
const calls: number[] = []
let breakerUntil = 0
let breakerReason = ''

/** Whether a live Token Factory call may be made right now. */
export function liveAllowed(): { ok: boolean; why?: string } {
  if (config.nemotronMode === 'replay') return { ok: false, why: 'NEMOTRON_MODE=replay' }
  if (Date.now() < breakerUntil) return { ok: false, why: breakerReason }
  if (config.nemotronMode === 'record') return { ok: true }
  const now = Date.now()
  while (calls.length && calls[0] < now - 86_400_000) calls.shift()
  const lastHour = calls.filter(t => t > now - 3_600_000).length
  if (lastHour >= config.liveCallsPerHour) return { ok: false, why: `spend cap: ${config.liveCallsPerHour} live calls per hour` }
  if (calls.length >= config.liveCallsPerDay) return { ok: false, why: `spend cap: ${config.liveCallsPerDay} live calls per day` }
  return { ok: true }
}

export const countLiveCall = () => calls.push(Date.now())

/** Billing or auth errors won't fix themselves within seconds: stop calling for a while instead of failing every request slowly. */
export function noteFailure(error = '') {
  if (/HTTP (401|402|403)/.test(error) || /billing|payment|insufficient|quota|balance/i.test(error)) {
    breakerUntil = Date.now() + 15 * 60_000
    breakerReason = `Token Factory unavailable (${error.slice(0, 60)})`
    console.warn('[llm] live calls paused for 15 min:', breakerReason)
  }
}

export const budgetStatus = () => {
  const now = Date.now()
  return {
    mode: config.nemotronMode,
    recordedAnswers: replayCount(),
    liveCallsLastHour: calls.filter(t => t > now - 3_600_000).length,
    liveCallsLastDay: calls.filter(t => t > now - 86_400_000).length,
    caps: { perHour: config.liveCallsPerHour, perDay: config.liveCallsPerDay },
    paused: Date.now() < breakerUntil ? breakerReason : null,
  }
}
