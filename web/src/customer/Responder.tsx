import { useEffect, useState } from 'react'
import { get, post, type TraceEvent } from '../api'
import { MiniTrace } from '../components'
import { useApp } from './CustomerApp'

interface Result {
  caseId: string
  message: string
  comfort: string
  summary: string
  actions: { tool: string; allowed: boolean; label: string }[]
  channels: { name: string; url: string; phone?: string; note?: string }[]
  sources: { title: string; url: string }[]
  channelsLive: boolean
  plan: string[]
  trace: TraceEvent[]
}

const SAMPLES: Record<string, string> = {
  en: 'A man called saying he was from my bank fraud team. He told me to move £4,800 to a safe account and not tell anyone. I sent it an hour ago.',
  es: 'Me llamó alguien del supuesto departamento de fraude de mi banco y me pidió mover 4.800 euros a una cuenta segura. Ya lo envié.',
  ar: 'اتصل بي شخص قال إنه من قسم الاحتيال في البنك وطلب مني تحويل ٤٨٠٠ إلى حساب آمن وعدم إخبار أحد. لقد حولت المبلغ قبل ساعة.',
  hi: 'किसी ने बैंक का फ्रॉड विभाग बनकर कॉल किया और ₹2,00,000 सुरक्षित खाते में भेजने को कहा। मैंने भेज दिए।',
  ur: 'ایک شخص نے بینک کا فراڈ ڈیپارٹمنٹ بن کر کال کی اور کہا کہ ۵ لاکھ روپے محفوظ اکاؤنٹ میں بھیج دوں۔ میں نے بھیج دیے۔',
}

export function Responder() {
  const { t, lang, country, meta } = useApp()
  const [text, setText] = useState('')
  const [ctry, setCtry] = useState(country)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Result>()
  const [status, setStatus] = useState<{ status: string; data: { timeline: { ts: number; event: string }[] } }>()

  useEffect(() => {
    setCtry(country)
  }, [country])
  useEffect(() => {
    if (!res) return
    const tick = () => get(`/api/cases/${res.caseId}`).then(setStatus).catch(() => {})
    tick()
    const h = setInterval(tick, 4000)
    return () => clearInterval(h)
  }, [res])

  const submit = async () => {
    setBusy(true)
    try {
      setRes(await post<Result>('/api/responder', { text, lang, country: ctry }))
    } finally {
      setBusy(false)
    }
  }

  if (!res)
    return (
      <div className="col fade-in">
        <h3>{t('beenScammed')}</h3>
        <div className="small muted">{t('describe')}</div>
        <textarea className="textarea" style={{ minHeight: 130 }} value={text} onChange={e => setText(e.target.value)} />
        <div className="row">
          <button className="btn small" onClick={() => setText(SAMPLES[lang] ?? SAMPLES.en)}>
            Demo
          </button>
          <select className="select" value={ctry} onChange={e => setCtry(e.target.value)} style={{ flex: 1 }}>
            {meta &&
              Object.entries(meta.countries).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </div>
        <button className="btn danger block" disabled={busy || !text.trim()} onClick={submit}>
          {busy ? (
            <>
              <span className="spinner" /> {t('checking')}
            </>
          ) : (
            t('getHelp')
          )}
        </button>
      </div>
    )

  return (
    <div className="col fade-in">
      <div className="card" style={{ background: 'linear-gradient(135deg, #12305e, #0e1f3d)', borderColor: '#24467e' }}>
        <h3 style={{ fontSize: 19 }}>{t('notAlone')}</h3>
        <p className="small" style={{ marginBottom: 0 }}>{res.comfort || res.message}</p>
        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <span className="small muted">{t('caseId')}</span>
          <span className="mono bold">{res.caseId}</span>
        </div>
      </div>

      <div className="card">
        <b>{t('whatWeDid')}</b>
        {res.actions.map(a => (
          <div key={a.tool} className="row small" style={{ marginTop: 6 }}>
            <span style={{ color: a.allowed ? 'var(--green)' : 'var(--red)' }}>{a.allowed ? '✓' : '✕'}</span>
            {a.label}
          </div>
        ))}
      </div>

      {res.plan.length > 0 && (
        <div className="card">
          <b>{t('nextSteps')}</b>
          <ol className="small" style={{ paddingInlineStart: 18, marginBottom: 0 }}>
            {res.plan.map((s, i) => (
              <li key={i} style={{ marginTop: 4 }}>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card">
        <b>{t('officialChannels')}</b>
        {res.channels.length ? (
          res.channels.map(c => (
            <div key={c.url} style={{ marginTop: 8 }}>
              <a href={c.url} target="_blank" rel="noreferrer" className="bold small">
                {c.name}
              </a>
              {c.phone && <div className="small mono">{c.phone}</div>}
              {c.note && <div className="small muted">{c.note}</div>}
              <div className="tiny faint" style={{ overflowWrap: 'anywhere' }}>{c.url}</div>
            </div>
          ))
        ) : (
          <div className="small muted" style={{ marginTop: 6 }}>{t('noChannels')}</div>
        )}
        {res.channelsLive && <div className="tiny faint" style={{ marginTop: 8 }}>Live search via Tavily · every link is from the returned sources</div>}
      </div>

      {status && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{t('caseStatus')}</b>
            <span className="pill accent">{status.status}</span>
          </div>
          {status.data.timeline.map((e, i) => (
            <div key={i} className="row small" style={{ marginTop: 6 }}>
              <span className="faint mono tiny" style={{ width: 64, flex: 'none' }}>{new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{e.event}</span>
            </div>
          ))}
        </div>
      )}
      <MiniTrace steps={res.trace} />
    </div>
  )
}
