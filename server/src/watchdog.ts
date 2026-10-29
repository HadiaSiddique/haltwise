/**
 * Watchdog: an independent tripwire that watches the AI agents rather than trusting them.
 *
 * Honeytokens are fake records (a customer, an account, an API key) that no legitimate code path ever touches.
 * Any touch is a breach signal. The watchdog escalates:
 *   level 1  WATCH       one honeytoken touched: alert the fraud team
 *   level 2  CONTAIN     repeated touches or an exfiltration attempt: cut the agents' outbound web access
 *   level 3  DISCONNECT  a money-movement attempt on a honeytoken: disconnect the AI entirely; deterministic rules
 *                        take over and customers get a signed notice through the official in-app channel
 * Only a bank officer can restore normal mode. It runs on its own timer and keeps its own state, so a compromised
 * agent cannot talk it down. (On the free host it shares the process; in production it is a separate service.)
 */
import { bus, audit, Run } from './trace.ts'
import { issueNotice } from './agents/callguard.ts'
import { guard } from './guard.ts'

export type Level = 0 | 1 | 2 | 3

export const HONEYTOKENS = [
  { id: 'HT-CUST-0007', kind: 'customer record', label: 'Customer "E. Varga" (never a real customer)' },
  { id: 'HT-ACCT-9312', kind: 'account', label: 'Account ****9312 with a large balance (decoy)' },
  { id: 'HT-KEY-ADMIN', kind: 'API key', label: 'Admin API key in a config file (decoy)' },
]

interface WatchEvent {
  ts: number
  token: string
  actor: string
  action: string
  level: Level
  note: string
}

const state = {
  level: 0 as Level,
  since: 0,
  events: [] as WatchEvent[],
  drill: false,
  lastHeartbeat: Date.now(),
}

const LEVEL_NAMES = ['NORMAL', 'WATCH', 'CONTAIN', 'DISCONNECT'] as const

/** Called from any code path that reads or acts on data. Real code never asks for a honeytoken. */
export function touchHoneytoken(token: string, actor: string, action: string) {
  if (!HONEYTOKENS.some(h => h.id === token)) return
  const moneyMove = /transfer|payment|withdraw|release/i.test(action)
  const exfil = /export|send_external|upload|webhook/i.test(action)
  const touches = state.events.length + 1
  const next: Level = moneyMove ? 3 : exfil || touches >= 2 ? Math.max(2, state.level) as Level : Math.max(1, state.level) as Level
  const ev: WatchEvent = {
    ts: Date.now(),
    token,
    actor,
    action,
    level: next,
    note: moneyMove ? 'money-movement attempt on a decoy account' : exfil ? 'attempt to send data outside the bank' : 'decoy record accessed',
  }
  state.events.push(ev)
  audit({ session: 'watchdog', actor: 'watchdog', action: `honeytoken:${action}`, target: token, result: 'BLOCKED', reason: `${actor} touched decoy ${token} (${ev.note})` })
  if (next > state.level) escalate(next, ev)
  bus.emit('event', { type: 'watchdog', data: status() })
}

function escalate(level: Level, ev: WatchEvent) {
  state.level = level
  guard.level = level
  state.since = Date.now()
  new Run('watchdog').log('watchdog', `level ${level} ${LEVEL_NAMES[level]}: ${ev.note}`, { status: 'blocked', detail: { token: ev.token, actor: ev.actor, action: ev.action } })
  if (level === 2) audit({ session: 'watchdog', actor: 'watchdog', action: 'contain', target: 'agents', result: 'DONE', reason: 'Outbound web access for AI agents cut (Tavily, external links).' })
  if (level === 3) {
    audit({ session: 'watchdog', actor: 'watchdog', action: 'disconnect_ai', target: 'all agents', result: 'DONE', reason: 'AI disconnected. Deterministic rules protect payments until a bank officer restores normal mode.' })
    issueNotice(120, 'Security notice from your bank: our assistant is in safe mode. Payments are still protected. We will only contact you through this app or the number on your card.')
  }
}

export function restore(officer: string) {
  const was = state.level
  state.level = 0
  guard.level = 0
  state.since = Date.now()
  state.drill = false
  audit({ session: 'watchdog', actor: 'officer', action: 'restore_normal_mode', target: 'all agents', result: 'DONE', reason: `${officer} restored normal mode (was level ${was}).` })
  new Run('watchdog').log('watchdog', 'normal mode restored by bank officer', { status: 'ok', detail: { was } })
  bus.emit('event', { type: 'watchdog', data: status() })
  return status()
}

export function status() {
  return {
    level: state.level,
    name: LEVEL_NAMES[state.level],
    since: state.since,
    drill: state.drill,
    heartbeat: state.lastHeartbeat,
    honeytokens: HONEYTOKENS,
    events: state.events.slice(-20).reverse(),
  }
}

/**
 * Breach drill: plays a compromised agent against the decoys, one step at a time, so officers can watch the
 * watchdog escalate in the console. Every step goes through the same tripwires as a real attack.
 */
export async function breachDrill() {
  state.drill = true
  state.events = []
  const steps: [string, string, string][] = [
    ['HT-CUST-0007', 'inspector (compromised)', 'read_customer_record'],
    ['HT-KEY-ADMIN', 'intel (compromised)', 'export_to_external_url'],
    ['HT-ACCT-9312', 'sentinel (compromised)', 'transfer_money'],
  ]
  for (const [token, actor, action] of steps) {
    touchHoneytoken(token, actor, action)
    await new Promise(r => setTimeout(r, 1200))
  }
  return status()
}

/** Independent heartbeat: the watchdog's own timer, recorded so the console can show it is alive. */
setInterval(() => {
  state.lastHeartbeat = Date.now()
}, 5000).unref()
