import { useState } from 'react'
import { post } from '../api'
import { useApp } from './CustomerApp'

interface Drill {
  channel: 'sms' | 'email' | 'call' | 'whatsapp'
  sender: string
  message: string
  isScam: boolean
  redFlags: string[]
  lesson: string
}

const CHANNEL_ICON: Record<Drill['channel'], string> = { sms: '💬', email: '✉️', call: '📞', whatsapp: '🟢' }

/** Scam IQ fire drill: fake messages written by Nemotron in the customer's language, answered one by one. */
export function ScamDrill() {
  const { t, lang, country, go } = useApp()
  const [drills, setDrills] = useState<Drill[]>()
  const [source, setSource] = useState('')
  const [i, setI] = useState(0)
  const [answer, setAnswer] = useState<boolean>()
  const [right, setRight] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const r = await post<{ drills: Drill[]; source: string; model: string }>('/api/drills', { lang, country })
      setDrills(r.drills)
      setSource(r.source === 'model' ? r.model.replace('nvidia/', '') : 'built-in set')
      setI(0)
      setRight(0)
      setAnswer(undefined)
      setDone(false)
    } finally {
      setBusy(false)
    }
  }

  const choose = (saysScam: boolean) => {
    if (!drills || answer !== undefined) return
    setAnswer(saysScam)
    if (saysScam === drills[i].isScam) setRight(r => r + 1)
  }

  const next = () => {
    if (!drills) return
    if (i + 1 >= drills.length) {
      setDone(true)
      post('/api/drills/score', { score: Math.round((right / drills.length) * 100) }).catch(() => {})
    } else {
      setI(i + 1)
      setAnswer(undefined)
    }
  }

  if (!drills || busy)
    return (
      <div className="col fade-in">
        <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => go('home')}>
          ←
        </button>
        <h3>{t('scamIq')}</h3>
        <div className="card">
          <div className="small">{t('drillIntro')}</div>
        </div>
        <button className="btn primary block" disabled={busy} onClick={start}>
          {busy ? (
            <>
              <span className="spinner" /> {t('writingDrill')}
            </>
          ) : (
            t('startDrill')
          )}
        </button>
      </div>
    )

  if (done) {
    const score = Math.round((right / drills.length) * 100)
    const color = score >= 83 ? 'var(--green)' : score >= 67 ? 'var(--amber)' : 'var(--red)'
    return (
      <div className="col fade-in">
        <h3>{t('yourScore')}</h3>
        <div className="card center">
          <div className="big-num" style={{ color, fontSize: 56 }}>{score}</div>
          <div className="small muted">
            {right} / {drills.length}
          </div>
          <div className="meter">
            <i style={{ width: `${Math.max(4, score)}%`, background: color }} />
          </div>
          <p className="small" style={{ marginBottom: 0 }}>{score >= 83 ? t('levelExpert') : score >= 67 ? t('levelGood') : t('levelPractise')}</p>
        </div>
        <button className="btn primary block" onClick={start}>
          {t('tryAgain')}
        </button>
        <div className="tiny faint center">{source}</div>
      </div>
    )
  }

  const d = drills[i]
  const answered = answer !== undefined
  const wasRight = answered && answer === d.isScam
  return (
    <div className="col fade-in" key={i}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{t('scamIq')}</h3>
        <span className="pill">
          {i + 1} / {drills.length}
        </span>
      </div>
      <div className="meter">
        <i style={{ width: `${((i + (answered ? 1 : 0)) / drills.length) * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div className="card">
        <div className="row small muted">
          <span>{CHANNEL_ICON[d.channel]}</span>
          <b style={{ color: 'var(--text)' }}>{d.sender}</b>
          <span className="tiny faint">{d.channel}</span>
        </div>
        <div style={{ marginTop: 10, lineHeight: 1.5 }}>{d.message}</div>
      </div>
      {!answered ? (
        <div className="row">
          <button className="btn danger grow" onClick={() => choose(true)}>
            {t('itsScam')}
          </button>
          <button className="btn grow" onClick={() => choose(false)}>
            {t('looksSafe')}
          </button>
        </div>
      ) : (
        <div className={`verdict ${wasRight ? 'likely_safe' : 'scam'} fade-in`}>
          <h3>{wasRight ? t('correct') : t('notQuite')}</h3>
          <div className="small" style={{ marginTop: 4 }}>{d.isScam ? t('thisWasScam') : t('thisWasSafe')}</div>
          {d.redFlags.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {d.redFlags.map(f => (
                <div className="flag small" key={f}>
                  {f}
                </div>
              ))}
            </div>
          )}
          {d.lesson && <div className="small bold" style={{ marginTop: 8 }}>{d.lesson}</div>}
          <button className="btn primary block" style={{ marginTop: 10 }} onClick={next}>
            {t('next')} →
          </button>
        </div>
      )}
    </div>
  )
}
