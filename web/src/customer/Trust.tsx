import { useEffect, useState } from 'react'
import { get, SESSION, type AuditEvent, type TraceEvent } from '../api'
import { Trace } from '../components'
import { useApp } from './CustomerApp'

export function TrustLog() {
  const { t } = useApp()
  const [data, setData] = useState<{ trace: TraceEvent[]; audit: AuditEvent[] }>()
  useEffect(() => {
    const load = () => get(`/api/trust?session=${SESSION}`).then(setData).catch(() => {})
    load()
    const h = setInterval(load, 4000)
    return () => clearInterval(h)
  }, [])
  return (
    <div className="col fade-in">
      <h3>{t('whatSaw')}</h3>
      <div className="alert-banner green">{t('brakeOnly')}</div>
      <div className="card">
        <b className="small">Policy gate</b>
        {(data?.audit ?? []).slice(0, 12).map(a => (
          <div key={a.id} className="row small" style={{ marginTop: 6, alignItems: 'flex-start' }}>
            <span className={`pill ${a.result === 'BLOCKED' ? 'red' : 'green'}`}>{a.result}</span>
            <span className="grow">
              <b>{a.actor}</b> → <span className="mono">{a.action}</span>
              <div className="tiny faint">{a.reason}</div>
            </span>
          </div>
        ))}
        {!data?.audit.length && <div className="small muted">—</div>}
      </div>
      <div className="card">
        <b className="small">Agent trace</b>
        <div style={{ marginTop: 8 }}>
          <Trace events={(data?.trace ?? []).slice(0, 20)} compact />
        </div>
      </div>
    </div>
  )
}
