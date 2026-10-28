import { createContext, useContext, useEffect, useState } from 'react'
import { get, money } from '../api'
import { Brand, Icons } from '../components'
import { useLiveAlerts } from '../site/Shell'
import { LANGS, isRtl, tr, type Key, type Lang } from '../i18n'
import { SendMoney } from './Send'
import { CheckMessage } from './Check'
import { CallGuard } from './CallGuard'
import { Responder } from './Responder'
import { TrustLog } from './Trust'

export type RailId = 'zelle' | 'fps' | 'sepa' | 'upi' | 'raast' | 'mpesa'
export interface Meta {
  customer: { code: string; name: string; accountMasked: string }
  rails: Record<RailId, { label: string; country: string; currency: string; payeeField: string; check: string; typical: number; balance: number }>
  countries: Record<string, string>
  demo: Record<string, { payeeName: string; payeeCode: string; amountFactor: number; reference: string; accounts: Record<RailId, string> }>
  policy: { principle: string; neverForAgents: string[] }
}

export interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: Key, v?: Record<string, string | number>) => string
  meta?: Meta
  rail: RailId
  setRail: (r: RailId) => void
  country: string
  call: { id: string; level: number } | null
  setCall: (c: { id: string; level: number } | null) => void
  guardian: boolean
  setGuardian: (g: boolean) => void
  go: (tab: Tab) => void
}

export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)

type Tab = 'home' | 'send' | 'check' | 'call' | 'help' | 'trust'
const TABS: { id: Tab; icon: JSX.Element }[] = [
  { id: 'home', icon: Icons.home },
  { id: 'send', icon: Icons.send },
  { id: 'check', icon: Icons.check },
  { id: 'call', icon: Icons.call },
  { id: 'help', icon: Icons.help },
  { id: 'trust', icon: Icons.trust },
]

export function CustomerApp({ full }: { full?: boolean }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('hw-lang') as Lang) || 'en'
    } catch {
      return 'en'
    }
  })
  const [tab, setTab] = useState<Tab>('home')
  const [meta, setMeta] = useState<Meta>()
  const [rail, setRail] = useState<RailId>('fps')
  const [call, setCall] = useState<{ id: string; level: number } | null>(null)
  const [guardian, setGuardian] = useState(false)
  useEffect(() => {
    get<Meta>('/api/meta').then(setMeta).catch(() => {})
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem('hw-lang', lang)
    } catch {}
  }, [lang])

  const country = meta?.rails[rail].country ?? 'GB'
  const ctx: Ctx = { lang, setLang, t: (k, v) => tr(lang, k, v), meta, rail, setRail, country, call, setCall, guardian, setGuardian, go: setTab }

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`phone ${full ? 'full' : ''}`} dir={isRtl(lang) ? 'rtl' : 'ltr'} lang={lang}>
        <div className="phone-top">
          <Brand />
          <div className="row">
            <select className="lang-select" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={tr(lang, 'language')}>
              {LANGS.map(l => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {call && (
          <div style={{ padding: '0 16px 8px' }}>
            <div className={`alert-banner ${call.level >= 2 ? 'red' : 'green'}`} onClick={() => setTab('call')} style={{ cursor: 'pointer' }}>
              <span className="live-dot" style={{ marginTop: 4, background: call.level >= 2 ? 'var(--red)' : undefined }} />
              {tr(lang, 'onCallNow')}
            </div>
          </div>
        )}
        <div className="phone-body">
          {tab === 'home' && <Home />}
          {tab === 'send' && <SendMoney />}
          {tab === 'check' && <CheckMessage />}
          {tab === 'call' && <CallGuard />}
          {tab === 'help' && <Responder />}
          {tab === 'trust' && <TrustLog />}
        </div>
        <nav className="tabbar">
          {TABS.map(x => (
            <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
              {x.icon}
              {tr(lang, x.id)}
            </button>
          ))}
        </nav>
      </div>
    </AppCtx.Provider>
  )
}

function Home() {
  const { t, meta, rail, setRail, country, go, guardian, setGuardian } = useApp()
  const [alerts, setAlerts] = useState<{ name: string; count: number; windowHours: number; sample: string }[]>([])
  useEffect(() => {
    get(`/api/radar/alerts?country=${country}`).then(setAlerts).catch(() => setAlerts([]))
  }, [country])
  // A real warning published this fortnight beats the sandbox campaign banner.
  const live = useLiveAlerts(country).alerts[0]
  const r = meta?.rails[rail]
  return (
    <div className="col fade-in">
      <div className="balance-card">
        <div className="row small muted" style={{ justifyContent: 'space-between' }}>
          <span>
            {t('hello')}, {meta?.customer.name.split(' ')[0] ?? '…'} · {meta?.customer.accountMasked}
          </span>
          <span className="tiny" title="Simulated account: no real money moves">
            {t('sandboxAccount')}
          </span>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>{t('balance')}</div>
        <div className="amt">{r ? money(r.balance, r.currency) : '—'}</div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <span className="pill accent">
            <span className="dot" /> {t('protectedBy')}
          </span>
          <select className="lang-select" value={rail} onChange={e => setRail(e.target.value as RailId)} aria-label={t('rail')}>
            {meta &&
              (Object.keys(meta.rails) as RailId[]).map(k => (
                <option key={k} value={k}>
                  {meta.rails[k].label} · {meta.rails[k].country}
                </option>
              ))}
          </select>
        </div>
      </div>

      {live && (
        <a className="alert-banner fade-in" href={live.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <span style={{ width: 18, flex: 'none' }}>{Icons.alert}</span>
          <div>
            <b>{t('scamAlert')}:</b> {live.title}
            <div className="tiny" style={{ opacity: 0.8, marginTop: 3 }}>
              {live.howItWorks} · {live.publisher} ↗
            </div>
          </div>
        </a>
      )}

      {!live && alerts.slice(0, 1).map(a => (
        <div className="alert-banner fade-in" key={a.name}>
          <span style={{ width: 18, flex: 'none' }}>{Icons.alert}</span>
          <div>
            <b>{t('scamAlert')}:</b> {a.name} · {a.count} {t('reports')} {t('inHours', { h: a.windowHours })}
            <div className="tiny" style={{ opacity: 0.8, marginTop: 3 }}>“{a.sample.slice(0, 90)}…”</div>
          </div>
        </div>
      ))}

      <div className="quick">
        <button onClick={() => go('send')}>
          <span className="ico">{Icons.send}</span>
          {t('sendMoney')}
        </button>
        <button onClick={() => go('check')}>
          <span className="ico">{Icons.check}</span>
          {t('checkMessage')}
        </button>
        <button onClick={() => go('call')}>
          <span className="ico">{Icons.call}</span>
          {t('imOnCall')}
        </button>
        <button onClick={() => go('help')}>
          <span className="ico red">{Icons.help}</span>
          {t('beenScammed')}
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="bold">{t('guardianMode')}</div>
            <div className="small muted">{t('guardianHint')}</div>
          </div>
          <button className={`btn small ${guardian ? 'primary' : ''}`} onClick={() => setGuardian(!guardian)}>
            {guardian ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div className="small faint center">{t('brakeOnly')}</div>
    </div>
  )
}
