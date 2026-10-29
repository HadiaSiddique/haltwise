import { useEffect, useState, type ReactNode } from 'react'
import { get, timeAgo } from '../api'
import { Brand } from '../components'

export const GITHUB = 'https://github.com/HadiaSiddique/haltwise'

export type Page = 'home' | 'app' | 'bank' | 'developers'

export function Nav({ active }: { active: Page }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="#/" aria-label="Haltwise home">
          <Brand />
        </a>
        <nav className="nav-links">
          <a href="#/" className={active === 'home' ? 'on' : ''}>
            Overview
          </a>
          <a href="#/app" className={active === 'app' ? 'on' : ''}>
            Customer app
          </a>
          <a href="#/bank" className={active === 'bank' ? 'on' : ''}>
            Bank console
          </a>
          <a href="#/developers" className={active === 'developers' ? 'on' : ''}>
            For banks
          </a>
        </nav>
        <div className="nav-right">
          {active === 'home' || active === 'developers' ? (
            <a className="btn primary small" href="#/app">
              Try it live
            </a>
          ) : (
            <span className="sandbox-chip" title="AI decisions and scam intelligence are live. Bank accounts, balances and transfers are simulated: no real money moves.">
              <i /> Sandbox bank
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <span className="bold" style={{ color: 'var(--text)' }}>
            Haltwise
          </span>{' '}
          · Apache-2.0 · Built for the Nebius x NVIDIA Global AI Hackathon
        </div>
        <div className="row wrap" style={{ gap: 16 }}>
          <a href="#/developers">For banks &amp; developers</a>
          <a href={GITHUB} target="_blank" rel="noreferrer">
            Source code (GitHub)
          </a>
          <a href={`${GITHUB}/blob/main/BENCHMARK.md`} target="_blank" rel="noreferrer">
            Benchmark
          </a>
          <a href="/v1/openapi.json" target="_blank" rel="noreferrer">
            API
          </a>
          <a href="#/demo">Presenter view</a>
        </div>
        <div style={{ width: '100%' }}>
          AI decisions run live on NVIDIA Nemotron via Nebius Token Factory; scam intelligence is live from the web via Tavily. Bank accounts, balances and transfers are a simulated sandbox: no real money moves.
        </div>
      </div>
    </footer>
  )
}

export function SiteLayout({ active, children }: { active: Page; children: ReactNode }) {
  // Block body on purpose: newer Chrome returns a Promise from scrollTo, and React would call it as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [active])
  return (
    <div className="site">
      <Nav active={active} />
      {children}
      {active !== 'bank' && <Footer />}
    </div>
  )
}

export interface LiveAlert {
  title: string
  category: string
  howItWorks: string
  publisher: string
  url: string
  published?: string
}

export function useLiveAlerts(country: string) {
  const [state, setState] = useState<{ alerts: LiveAlert[]; loading: boolean; fetchedAt?: number }>({ alerts: [], loading: true })
  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true }))
    get<{ alerts: LiveAlert[]; fetchedAt: number }>(`/api/live-alerts?country=${country}`)
      .then(d => alive && setState({ alerts: d.alerts ?? [], loading: false, fetchedAt: d.fetchedAt }))
      .catch(() => alive && setState({ alerts: [], loading: false }))
    return () => {
      alive = false
    }
  }, [country])
  return state
}

const fmtDate = (s?: string) => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(+d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function LiveAlertsList({ country, limit = 6 }: { country: string; limit?: number }) {
  const { alerts, loading, fetchedAt } = useLiveAlerts(country)
  if (loading)
    return (
      <div className="alerts-list">
        {Array.from({ length: Math.min(4, limit) }, (_, i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    )
  if (!alerts.length) return <div className="muted small">No new warnings found for this country in the last 14 days, or the live search is unavailable right now.</div>
  return (
    <>
      <div className="alerts-list">
        {alerts.slice(0, limit).map(a => (
          <a key={a.url} className="alert-item fade-in" href={a.url} target="_blank" rel="noreferrer">
            <span className="pill red">{a.category.replace(/_/g, ' ')}</span>
            <h4>{a.title}</h4>
            <p>{a.howItWorks}</p>
            <div className="alert-meta">
              <span>{a.publisher}</span>
              {a.published && <span>· {fmtDate(a.published)}</span>}
              <span>· source ↗</span>
            </div>
          </a>
        ))}
      </div>
      {fetchedAt && (
        <div className="source-note">
          Found live with Tavily news search, summarised by Nemotron 3 Super · updated {timeAgo(fetchedAt)}
        </div>
      )}
    </>
  )
}
