import { useEffect, useRef, useState } from 'react'
import { post, type TraceEvent } from '../api'
import { MiniTrace } from '../components'
import { LANGS } from '../i18n'
import { useApp } from './CustomerApp'

interface CallState {
  id: string
  level: number
  claimsBank: boolean
  matched: boolean
  tactics: { id: string; quote: string; label: string }[]
  warning: string
  trace?: TraceEvent[]
}

const SCRIPT: Record<string, string[]> = {
  en: [
    "Hello, this is the fraud department at your bank. We've detected suspicious activity on your account.",
    'Someone is trying to take your savings right now, so we need to act immediately.',
    "To protect your money, you need to move it to a safe account we've set up in your name.",
    "Don't tell anyone at the branch about this call. Some staff may be involved.",
    "If the bank asks why you're moving the money, just say it's for a family member.",
  ],
  es: [
    'Hola, le llamamos del departamento de fraude de su banco. Hemos detectado actividad sospechosa.',
    'Alguien intenta llevarse sus ahorros ahora mismo, tenemos que actuar inmediatamente.',
    'Para proteger su dinero, debe moverlo a una cuenta segura que hemos abierto a su nombre.',
    'No le diga nada al personal de la sucursal, algunos empleados podrían estar implicados.',
    'Si el banco le pregunta, diga que el dinero es para un familiar.',
  ],
  ar: [
    'مرحبًا، معك قسم الاحتيال في البنك. رصدنا نشاطًا مريبًا في حسابك.',
    'هناك من يحاول سحب مدخراتك الآن، يجب أن نتصرف فورا.',
    'لحماية أموالك يجب نقلها إلى حساب آمن فتحناه باسمك.',
    'لا تخبر أحدًا في الفرع، بعض الموظفين متورطون.',
  ],
  hi: [
    'नमस्ते, मैं आपके बैंक के फ्रॉड विभाग से बोल रहा हूँ। आपके खाते में संदिग्ध गतिविधि है।',
    'कोई अभी आपकी बचत निकालने की कोशिश कर रहा है, हमें तुरंत कदम उठाना होगा।',
    'अपने पैसे बचाने के लिए उन्हें सुरक्षित खाते में ट्रांसफर करें।',
    'शाखा में किसी को मत बताएं।',
  ],
  ur: [
    'السلام علیکم، میں آپ کے بینک کے فراڈ ڈیپارٹمنٹ سے بات کر رہا ہوں۔',
    'کوئی ابھی آپ کی بچت نکالنے کی کوشش کر رہا ہے، فوری کارروائی ضروری ہے۔',
    'اپنی رقم بچانے کے لیے اسے محفوظ اکاؤنٹ میں منتقل کریں۔',
    'برانچ میں کسی کو نہ بتائیں۔',
  ],
}

export function CallGuard() {
  const { t, lang, call, setCall, go } = useApp()
  const [state, setState] = useState<CallState>()
  const [lines, setLines] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const [typed, setTyped] = useState('')
  const [voice, setVoice] = useState(true)
  const [steps, setSteps] = useState<TraceEvent[]>([])
  const rec = useRef<any>(null)
  const listeningRef = useRef(false)
  const idRef = useRef<string>()

  useEffect(() => () => stopListening(), [])

  const start = async (claimsBank: boolean) => {
    const s = await post<CallState>('/api/callguard/start', { lang, claimsBank })
    idRef.current = s.id
    setState(s)
    setSteps(s.trace ?? [])
    setLines([])
    setCall({ id: s.id, level: s.level })
  }

  const sendChunk = async (text: string) => {
    if (!idRef.current || !text.trim()) return
    setLines(l => [...l, text])
    const s = await post<CallState>(`/api/callguard/${idRef.current}/chunk`, { text })
    setState(s)
    setSteps(prev => [...prev, ...(s.trace ?? [])].slice(-8))
    setCall({ id: s.id, level: s.level })
  }

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Speech recognition is not available in this browser. Use Chrome or Edge, or type / play the demo call.')
      return
    }
    const r = new SR()
    r.lang = LANGS.find(l => l.code === lang)?.speech ?? 'en-US'
    r.continuous = true
    r.interimResults = false
    try {
      r.processLocally = true // on-device recognition where the browser supports it
    } catch {}
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) sendChunk(e.results[i][0].transcript)
    }
    r.onend = () => listeningRef.current && r.start()
    r.start()
    rec.current = r
    listeningRef.current = true
    setListening(true)
  }

  function stopListening() {
    listeningRef.current = false
    rec.current?.stop?.()
    setListening(false)
  }

  const simulate = async () => {
    const script = SCRIPT[lang] ?? SCRIPT.en
    for (const line of script) {
      if (voice && 'speechSynthesis' in window) {
        await new Promise<void>(res => {
          const u = new SpeechSynthesisUtterance(line)
          u.lang = LANGS.find(l => l.code === lang)?.speech ?? 'en-US'
          u.rate = 1.05
          u.onend = () => res()
          u.onerror = () => res()
          speechSynthesis.speak(u)
          setTimeout(res, 9000)
        })
      } else {
        await new Promise(r => setTimeout(r, 1800))
      }
      await sendChunk(line)
    }
  }

  const hangUp = () => {
    stopListening()
    speechSynthesis?.cancel?.()
    setCall(null)
    setState(undefined)
    idRef.current = undefined
  }

  const level = state?.level ?? 0
  const levelColor = level >= 3 ? 'var(--red)' : level === 2 ? 'var(--amber)' : 'var(--green)'

  if (!state)
    return (
      <div className="col fade-in">
        <h3>{t('call')}</h3>
        <div className="card">
          <div className="bold">{t('callerSaysBank')}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary grow" onClick={() => start(true)}>
              {t('yes')}
            </button>
            <button className="btn grow" onClick={() => start(false)}>
              {t('no')}
            </button>
          </div>
        </div>
        <div className="small muted">{t('noAudio')}</div>
        {/* Coming back to this tab mid-call: the call screen is gone, but the customer must still be able to end it. */}
        {call && (
          <>
            <div className="alert-banner">{t('onCallNow')}</div>
            <button className="hangup" onClick={hangUp}>
              {t('hangUp')}
            </button>
          </>
        )}
      </div>
    )

  return (
    <div className="col fade-in">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{t('call')}</h3>
        <span className="pill" style={{ color: levelColor }}>
          <span className="live-dot" style={{ background: levelColor }} /> {listening ? t('listening') : 'Live'}
        </span>
      </div>

      {state.claimsBank && (
        <div className={`alert-banner ${state.matched ? 'green' : 'red'}`}>{state.matched ? t('noticeOk') : t('noNotice')}</div>
      )}

      <div className="call-level">
        <i style={{ width: `${Math.max(6, level * 33)}%`, background: levelColor }} />
      </div>

      {state.warning && (
        <div className="verdict scam fade-in">
          <div className="small bold">{state.warning}</div>
        </div>
      )}
      {level >= 2 && (
        <button className="hangup" onClick={hangUp}>
          {t('hangUp')}
        </button>
      )}

      {state.tactics.length > 0 && (
        <div className="card">
          {state.tactics.map(x => (
            <div className="flag small" key={x.id}>
              <b>{x.label}</b> {x.quote && <q>{x.quote}</q>}
            </div>
          ))}
        </div>
      )}

      <div className="transcript">
        {lines.map((l, i) => (
          <div key={i} className="fade-in">
            {l}
          </div>
        ))}
      </div>

      <div className="row">
        {listening ? (
          <button className="btn grow" onClick={stopListening}>
            ■ {t('stop')}
          </button>
        ) : (
          <button className="btn grow" onClick={startListening}>
            🎙 {t('useMic')}
          </button>
        )}
        <button className="btn grow" onClick={simulate}>
          ▶ {t('simulate')}
        </button>
      </div>
      <label className="row tiny muted">
        <input type="checkbox" checked={voice} onChange={e => setVoice(e.target.checked)} /> speak demo lines aloud
      </label>
      <div className="row">
        <input className="input" placeholder={t('typeWhatYouHear')} value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => e.key === 'Enter' && (sendChunk(typed), setTyped(''))} />
      </div>
      <button className="btn ghost small" onClick={() => go('send')}>
        {t('sendMoney')} →
      </button>
      <div className="tiny faint">{t('noAudio')}</div>
      <MiniTrace steps={steps} />
    </div>
  )
}
