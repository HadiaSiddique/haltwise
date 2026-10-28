import { useState } from 'react'
import { post, money, type TraceEvent } from '../api'
import { Meter, MiniTrace } from '../components'
import { useApp, type RailId } from './CustomerApp'

interface Assessment {
  transferId: string
  caseId?: string
  decision: 'release' | 'verify' | 'hold' | 'guardian'
  risk: number
  factors: { id: string; label: string; points: number }[]
  payeeCheck: { result: 'match' | 'close_match' | 'no_match' | 'unavailable'; registeredName?: string; scheme: string }
  questions: { id: string; text: string }[]
  payeeExplanation: string
  scamPattern: string
  message: string
  trace: TraceEvent[]
}

export function SendMoney() {
  const { t, meta, rail, setRail, lang, call, guardian } = useApp()
  const r = meta?.rails[rail]
  const [form, setForm] = useState({ payeeName: '', account: '', amount: '', reference: '' })
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<Assessment>()
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const [stage, setStage] = useState<'form' | 'result' | 'verified' | 'held' | 'released' | 'cancelled' | 'callback'>('form')
  const [extraTrace, setExtraTrace] = useState<TraceEvent[]>([])

  const fill = (k: 'safeAccount' | 'rent') => {
    const d = meta?.demo[k]
    if (!d || !r) return
    setForm({ payeeName: d.payeeName, account: d.accounts[rail], amount: String(Math.round(r.typical * d.amountFactor)), reference: d.reference })
  }

  const submit = async () => {
    setBusy(true)
    setExtraTrace([])
    try {
      const a = await post<Assessment>('/api/transfer', { ...form, amount: Number(form.amount), rail, lang, callId: call?.id, guardianMode: guardian })
      setRes(a)
      setAnswers({})
      setStage(a.decision === 'release' ? 'released' : a.decision === 'hold' ? 'held' : 'result')
    } finally {
      setBusy(false)
    }
  }

  const sendAnswers = async () => {
    if (!res) return
    setBusy(true)
    const out = await post<{ status: string; trace: TraceEvent[] }>(`/api/transfer/${res.transferId}/answers`, { answers, lang })
    setExtraTrace(out.trace)
    setStage(out.status === 'held' ? 'held' : 'verified')
    setBusy(false)
  }
  const confirm = async () => {
    if (!res) return
    const out = await post<{ status: string; trace: TraceEvent[] }>(`/api/transfer/${res.transferId}/confirm`)
    setExtraTrace(out.trace)
    setStage(out.status === 'released' ? 'released' : 'held')
  }

  if (!r) return <div className="spinner" />

  if (stage === 'form')
    return (
      <div className="col fade-in">
        <h3>{t('sendMoney')}</h3>
        <div className="row wrap">
          <button className="btn small" onClick={() => fill('safeAccount')}>
            {t('demoScam')}
          </button>
          <button className="btn small" onClick={() => fill('rent')}>
            {t('demoRent')}
          </button>
        </div>
        <div>
          <label className="label">{t('rail')}</label>
          <select className="select" value={rail} onChange={e => setRail(e.target.value as RailId)}>
            {meta &&
              (Object.keys(meta.rails) as RailId[]).map(k => (
                <option key={k} value={k}>
                  {meta.rails[k].label} ({meta.rails[k].country}, {meta.rails[k].currency})
                </option>
              ))}
          </select>
          <label className="label">{t('payeeName')}</label>
          <input className="input" aria-label={t('payeeName')} value={form.payeeName} onChange={e => setForm({ ...form, payeeName: e.target.value })} />
          <label className="label">{r.payeeField}</label>
          <input className="input mono" aria-label={r.payeeField} value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} dir="ltr" />
          <label className="label">
            {t('amount')} ({r.currency})
          </label>
          <input className="input" aria-label={t('amount')} inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} dir="ltr" />
          <label className="label">{t('reference')}</label>
          <input className="input" aria-label={t('reference')} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
        </div>
        <button className="btn primary block" disabled={busy || !form.account || !form.amount} onClick={submit}>
          {busy ? (
            <>
              <span className="spinner" /> {t('checking')}
            </>
          ) : (
            t('continue')
          )}
        </button>
        <div className="tiny faint center">
          {r.check} · {r.label}
        </div>
      </div>
    )

  const amount = money(Number(form.amount), r.currency)
  const vop = res?.payeeCheck
  const vopColor = vop?.result === 'match' ? 'green' : vop?.result === 'close_match' ? 'amber' : vop?.result === 'no_match' ? 'red' : ''
  const status = stage === 'released' ? 'released' : stage === 'held' || stage === 'callback' ? 'held' : res?.decision === 'guardian' ? 'guardian' : 'verify'
  const title = stage === 'released' ? t('sent') : stage === 'held' || stage === 'callback' ? t('held') : res?.decision === 'guardian' ? t('guardianWait') : t('paused')

  return (
    <div className="col fade-in">
      <div className={`verdict ${status}`}>
        <h3>{title}</h3>
        <div className="small" style={{ marginTop: 4 }}>
          {amount} → {form.payeeName || '—'} · <span className="mono">****{form.account.replace(/\D/g, '').slice(-4)}</span>
        </div>
        {res && (
          <>
            <div className="row small" style={{ marginTop: 10, justifyContent: 'space-between' }}>
              <span>{t('risk')}</span>
              <b>{res.risk}/100</b>
            </div>
            <Meter value={res.risk} />
          </>
        )}
        {stage !== 'released' && <div className="small" style={{ marginTop: 10 }}>{res?.message || t('nothingLeft')}</div>}
      </div>

      {vop && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{t('payeeCheck')}</b>
            <span className={`pill ${vopColor}`}>{t(vop.result)}</span>
          </div>
          <div className="tiny faint" style={{ marginTop: 2 }}>{vop.scheme} · simulated</div>
          {vop.registeredName && vop.result !== 'match' && (
            <div className="small" style={{ marginTop: 8 }}>
              {t('registeredTo')}: <b>{vop.registeredName}</b>
            </div>
          )}
          {res?.payeeExplanation && <div className="small" style={{ marginTop: 8 }}>{res.payeeExplanation}</div>}
        </div>
      )}

      {res && res.decision !== 'release' && (
        <div className="card">
          <b>{t('whyPaused')}</b>
          {res.factors
            .filter(f => f.id !== 'instant_rail')
            .map(f => (
              <div key={f.id} className="row small" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span>{f.label}</span>
                <span className="faint">+{f.points}</span>
              </div>
            ))}
          {res.scamPattern && <div className="small muted" style={{ marginTop: 8 }}>{res.scamPattern}</div>}
        </div>
      )}

      {stage === 'result' && res?.decision === 'verify' && (
        <div className="card">
          <b>{t('quickQuestions')}</b>
          {res.questions.map(q => (
            <div className="q-row" key={q.id}>
              <span className="grow small">{q.text}</span>
              <div className="seg" style={{ width: 120 }}>
                {(['yes', 'no'] as const).map(v => (
                  <button key={v} className={answers[q.id] === v ? 'on' : ''} onClick={() => setAnswers({ ...answers, [q.id]: v })}>
                    {t(v)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || Object.keys(answers).length < res.questions.length} onClick={sendAnswers}>
            {t('submit')}
          </button>
        </div>
      )}

      {stage === 'verified' && (
        <div className="row">
          <button className="btn primary grow" onClick={confirm}>
            {t('confirmSend')}
          </button>
          <button className="btn" onClick={() => setStage('cancelled')}>
            {t('cancelPayment')}
          </button>
        </div>
      )}

      {(stage === 'held' || stage === 'callback') && (
        <div className="col">
          {stage === 'callback' ? (
            <div className="alert-banner green">{t('callbackDone')}</div>
          ) : (
            <button className="btn primary block" onClick={() => setStage('callback')}>
              {t('callback')}
            </button>
          )}
          <button className="btn block" onClick={() => setStage('cancelled')}>
            {t('cancelPayment')}
          </button>
        </div>
      )}

      {stage === 'cancelled' && <div className="alert-banner green">{t('nothingLeft')}</div>}

      <MiniTrace steps={[...(res?.trace ?? []), ...extraTrace]} />
      <button className="btn ghost small" onClick={() => (setStage('form'), setRes(undefined))}>
        ← {t('sendMoney')}
      </button>
    </div>
  )
}
