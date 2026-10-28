import { db, newId } from './db.ts'
import { bus } from './trace.ts'
import { CUSTOMER } from './seed.ts'

export interface Case {
  id: string
  kind: 'transfer_hold' | 'scam_report' | 'call_alert' | 'message_alert'
  status: 'open' | 'held' | 'investigating' | 'resolved' | 'released' | 'rejected'
  risk: number
  title: string
  customer: string
  lang: string
  country: string
  data: Record<string, any>
  createdAt: number
  updatedAt: number
}

export function createCase(c: Pick<Case, 'kind' | 'status' | 'risk' | 'title' | 'lang' | 'country'> & { data?: Record<string, any>; id?: string }): Case {
  const now = Date.now()
  const full: Case = { id: c.id ?? newId('HW'), customer: CUSTOMER.code, data: {}, createdAt: now, updatedAt: now, ...c } as Case
  full.data = { timeline: [{ ts: now, event: 'Case opened' }], ...(c.data ?? {}) }
  db.prepare('INSERT INTO cases (id, kind, status, risk, title, customer, lang, country, data, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
    full.id, full.kind, full.status, full.risk, full.title, full.customer, full.lang, full.country, JSON.stringify(full.data), now, now,
  )
  bus.emit('event', { type: 'case', data: full })
  return full
}

export function getCase(id: string): Case | undefined {
  const r = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as Record<string, any> | undefined
  return r ? rowToCase(r) : undefined
}

export function listCases(limit = 100): Case[] {
  return (db.prepare('SELECT * FROM cases ORDER BY updated_at DESC LIMIT ?').all(limit) as Record<string, any>[]).map(rowToCase)
}

export function updateCase(id: string, patch: Partial<Pick<Case, 'status' | 'risk' | 'title'>> & { data?: Record<string, any>; event?: string }) {
  const c = getCase(id)
  if (!c) return undefined
  const now = Date.now()
  const data = { ...c.data, ...(patch.data ?? {}) }
  if (patch.event) data.timeline = [...(c.data.timeline ?? []), { ts: now, event: patch.event }]
  const next: Case = { ...c, ...patch, data, updatedAt: now }
  db.prepare('UPDATE cases SET status = ?, risk = ?, title = ?, data = ?, updated_at = ? WHERE id = ?').run(next.status, next.risk, next.title, JSON.stringify(next.data), now, id)
  bus.emit('event', { type: 'case', data: next })
  return next
}

function rowToCase(r: Record<string, any>): Case {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    risk: r.risk,
    title: r.title,
    customer: r.customer,
    lang: r.lang,
    country: r.country,
    data: JSON.parse(r.data ?? '{}'),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}
