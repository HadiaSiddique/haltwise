/**
 * Bank / developer access to the public API.
 *
 * Sandbox API keys are self-contained and HMAC-signed: the server can verify them without a database, so they keep
 * working on a free host whose disk is wiped on every restart. The key is also the login: pasting it shows the
 * account it belongs to. A production deployment would add SSO, key rotation and a persistent store.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.ts'

export interface KeyInfo {
  org: string
  email: string
  country: string
  plan: 'sandbox'
  iat: number
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8')
const sign = (payload: string) => createHmac('sha256', `api-keys:${config.signingSecret}`).update(payload).digest('base64url').slice(0, 32)

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i

export function issueKey(input: { org?: unknown; email?: unknown; country?: unknown }): { key: string; info: KeyInfo } | { error: string } {
  const org = String(input.org ?? '').trim().replace(/\s+/g, ' ')
  const email = String(input.email ?? '').trim().toLowerCase()
  const country = String(input.country ?? '').trim().toUpperCase().slice(0, 2)
  if (org.length < 2 || org.length > 80) return { error: 'Organisation name must be 2-80 characters.' }
  if (!EMAIL.test(email)) return { error: 'Enter a valid work email.' }
  const info: KeyInfo = { org, email, country: /^[A-Z]{2}$/.test(country) ? country : 'XX', plan: 'sandbox', iat: Date.now() }
  const payload = b64(JSON.stringify(info))
  return { key: `hw_sandbox_${payload}.${sign(payload)}`, info }
}

export function verifyKey(raw: string | undefined | null): KeyInfo | undefined {
  const key = String(raw ?? '').replace(/^Bearer\s+/i, '').trim()
  const m = key.match(/^hw_sandbox_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{32})$/)
  if (!m) return undefined
  const expected = Buffer.from(sign(m[1]))
  const given = Buffer.from(m[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined
  try {
    return JSON.parse(unb64(m[1])) as KeyInfo
  } catch {
    return undefined
  }
}

/** In-memory usage and rate limiting per key (sandbox: 30 checks per minute). Resets when the server restarts. */
const usage = new Map<string, { total: number; window: number; count: number; last: number }>()
const PER_MINUTE = 30

export function meter(key: string): { ok: boolean; remaining: number; total: number } {
  const id = key.slice(-32)
  const now = Date.now()
  const u = usage.get(id) ?? { total: 0, window: now, count: 0, last: 0 }
  if (now - u.window > 60_000) (u.window = now), (u.count = 0)
  if (u.count >= PER_MINUTE) return { ok: false, remaining: 0, total: u.total }
  u.count++
  u.total++
  u.last = now
  usage.set(id, u)
  return { ok: true, remaining: PER_MINUTE - u.count, total: u.total }
}

export function usageOf(key: string) {
  const u = usage.get(key.slice(-32))
  return { checksSinceRestart: u?.total ?? 0, lastCheck: u?.last || null, limitPerMinute: PER_MINUTE }
}

/** Light abuse guard for the open sign-up form: 5 keys per IP per hour. */
const signups = new Map<string, number[]>()
export function signupAllowed(ip: string) {
  const now = Date.now()
  const recent = (signups.get(ip) ?? []).filter(t => now - t < 3600_000)
  if (recent.length >= 5) return false
  signups.set(ip, [...recent, now])
  return true
}
