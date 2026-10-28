import type { ReactNode } from 'react'
import type { TraceEvent } from './api'

export const Brand = ({ sub }: { sub?: string }) => (
  <div className="brand">
    <span className="brand-mark">
      <i />
      <i />
    </span>
    <span>
      Haltwise{sub && <span className="faint" style={{ fontWeight: 500, marginInlineStart: 8 }}>{sub}</span>}
    </span>
  </div>
)

export const DemoTag = ({ label = 'Demo data' }: { label?: string }) => <span className="pill demo-tag">{label}</span>

const shortModel = (m?: string) => (m ? m.replace(/^nvidia\//, '') : '')

export function modelClass(m?: string) {
  if (!m) return ''
  if (m === 'tavily') return 'tavily'
  if (m === 'rules' || m === 'none') return 'rules'
  return ''
}

export function TraceItem({ e, compact }: { e: TraceEvent; compact?: boolean }) {
  return (
    <div className={`trace-item ${e.status}`}>
      <div className="trace-rail">
        <span className="node" />
        <span className="stem" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="head">
          <span className="agent-name">{e.agent}</span>
          <span className="small">{e.step}</span>
          {e.model && <span className={`model-chip ${modelClass(e.model)}`}>{shortModel(e.model)}</span>}
          {e.ms != null && e.ms > 0 && <span className="tiny faint">{e.ms} ms</span>}
          {e.status === 'blocked' && <span className="pill red">BLOCKED</span>}
          {e.status === 'fallback' && <span className="pill amber">fallback</span>}
        </div>
        {!compact && e.detail != null && <div className="trace-detail">{typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail, null, 0)}</div>}
        {!compact && (
          <div className="tiny faint" style={{ marginTop: 2 }}>
            {new Date(e.ts).toLocaleTimeString()} · {e.session}
            {e.caseId ? ` · ${e.caseId}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export function Trace({ events, compact, empty }: { events: TraceEvent[]; compact?: boolean; empty?: ReactNode }) {
  if (!events.length) return <div className="muted small">{empty ?? 'No agent activity yet.'}</div>
  return (
    <div className="trace">
      {events.map(e => (
        <TraceItem key={e.id ?? `${e.ts}-${e.step}`} e={e} compact={compact} />
      ))}
    </div>
  )
}

/** Compact "what the agents did" strip under customer results. */
export function MiniTrace({ steps }: { steps?: TraceEvent[] }) {
  if (!steps?.length) return null
  return (
    <div className="mini-trace">
      {steps.map((s, i) => (
        <div className="t" key={i} style={{ animationDelay: `${i * 80}ms` }}>
          <span className="dot" style={{ color: s.status === 'blocked' ? 'var(--red)' : s.status === 'fallback' ? 'var(--amber)' : 'var(--accent)' }} />
          <span className="bold" style={{ textTransform: 'capitalize' }}>{s.agent}</span>
          <span className="grow">{s.step}</span>
          {s.model && <span className={`model-chip ${modelClass(s.model)}`}>{shortModel(s.model)}</span>}
        </div>
      ))}
    </div>
  )
}

export const riskColor = (r: number) => (r >= 65 ? 'var(--red)' : r >= 30 ? 'var(--amber)' : 'var(--green)')

export const Meter = ({ value }: { value: number }) => (
  <div className="meter">
    <i style={{ width: `${Math.max(4, value)}%`, background: riskColor(value) }} />
  </div>
)

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
export const Icons = {
  home: I('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  send: I('M4 12h14M13 6l6 6-6 6'),
  check: I('M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5'),
  call: I('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'),
  help: I('M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z'),
  trust: I('M4 6h16M4 12h16M4 18h10'),
  alert: I('M12 3l10 18H2zM12 10v5M12 18v.5'),
}
