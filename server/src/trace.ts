import { EventEmitter } from 'node:events'
import { db } from './db.ts'

export type TraceStatus = 'ok' | 'fallback' | 'blocked' | 'error' | 'info'

export interface TraceEvent {
  id?: number
  session: string
  caseId?: string
  agent: string
  step: string
  model?: string
  ms?: number
  status: TraceStatus
  detail?: unknown
  ts: number
}

export interface AuditEvent {
  id?: number
  session: string
  actor: string
  action: string
  target: string
  result: 'ALLOWED' | 'BLOCKED' | 'DONE'
  reason: string
  ts: number
}

/** Live event bus: every trace/audit/case change is pushed to SSE subscribers. */
export const bus = new EventEmitter()
bus.setMaxListeners(200)

/** One agent run: collects its steps so the HTTP response can return them too. */
export class Run {
  steps: TraceEvent[] = []
  constructor(
    public session: string,
    public caseId?: string,
  ) {}

  log(agent: string, step: string, extra: Partial<Omit<TraceEvent, 'agent' | 'step' | 'session'>> = {}) {
    const ev: TraceEvent = {
      session: this.session,
      caseId: extra.caseId ?? this.caseId,
      agent,
      step,
      model: extra.model,
      ms: extra.ms,
      status: extra.status ?? 'ok',
      detail: extra.detail,
      ts: Date.now(),
    }
    const res = db
      .prepare('INSERT INTO trace (session, case_id, agent, step, model, ms, status, detail, ts) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(ev.session, ev.caseId ?? null, ev.agent, ev.step, ev.model ?? null, ev.ms ?? null, ev.status, JSON.stringify(ev.detail ?? null), ev.ts)
    ev.id = Number(res.lastInsertRowid)
    this.steps.push(ev)
    bus.emit('event', { type: 'trace', data: ev })
    return ev
  }
}

export function audit(ev: Omit<AuditEvent, 'ts' | 'id'>) {
  const full: AuditEvent = { ...ev, ts: Date.now() }
  const res = db
    .prepare('INSERT INTO audit (session, actor, action, target, result, reason, ts) VALUES (?,?,?,?,?,?,?)')
    .run(full.session, full.actor, full.action, full.target, full.result, full.reason, full.ts)
  full.id = Number(res.lastInsertRowid)
  bus.emit('event', { type: 'audit', data: full })
  return full
}

export function recentTrace(limit = 200, filter: { session?: string; caseId?: string } = {}) {
  const where: string[] = []
  const args: (string | number)[] = []
  if (filter.session) (where.push('session = ?'), args.push(filter.session))
  if (filter.caseId) (where.push('case_id = ?'), args.push(filter.caseId))
  const rows = db
    .prepare(`SELECT * FROM trace ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
    .all(...args, limit) as Record<string, unknown>[]
  return rows.map(r => ({
    id: r.id,
    session: r.session,
    caseId: r.case_id,
    agent: r.agent,
    step: r.step,
    model: r.model,
    ms: r.ms,
    status: r.status,
    detail: JSON.parse(String(r.detail ?? 'null')),
    ts: r.ts,
  }))
}

export function recentAudit(limit = 200, session?: string) {
  return session
    ? db.prepare('SELECT * FROM audit WHERE session = ? ORDER BY id DESC LIMIT ?').all(session, limit)
    : db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT ?').all(limit)
}
