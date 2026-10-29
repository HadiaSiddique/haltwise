import { useEffect, useState } from 'react'
import { SiteLayout } from './Shell'

interface Account {
  org: string
  email: string
  country: string
  plan: string
  iat: number
}

const STORE = 'hw-dev-key'
const loadKey = () => {
  try {
    return localStorage.getItem(STORE) ?? ''
  } catch {
    return ''
  }
}
const saveKey = (k: string) => {
  try {
    if (k) localStorage.setItem(STORE, k)
    else localStorage.removeItem(STORE)
  } catch {}
}

const COUNTRIES: [string, string][] = [
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['PK', 'Pakistan'],
  ['IN', 'India'],
  ['KE', 'Kenya'],
  ['AE', 'United Arab Emirates'],
  ['ES', 'Spain'],
  ['DE', 'Germany'],
  ['XX', 'Other'],
]

export function Developers() {
  const origin = location.origin
  const [key, setKey] = useState(loadKey)
  const [account, setAccount] = useState<Account>()
  const [usage, setUsage] = useState<{ checksSinceRestart: number; limitPerMinute: number }>()
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [form, setForm] = useState({ org: '', email: '', country: 'PK' })
  const [loginKey, setLoginKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [justCreated, setJustCreated] = useState(false)

  const refresh = async (k: string) => {
    const r = await fetch('/api/developers/me', { headers: { Authorization: `Bearer ${k}` } })
    if (!r.ok) throw new Error((await r.json()).error ?? 'Invalid key')
    const j = await r.json()
    setAccount(j.account)
    setUsage(j.usage)
  }

  useEffect(() => {
    if (key) refresh(key).catch(() => (setKey(''), saveKey('')))
  }, [])

  const signup = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/developers/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setKey(j.key)
      saveKey(j.key)
      setAccount(j.account)
      setUsage({ checksSinceRestart: 0, limitPerMinute: 30 })
      setJustCreated(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const login = async () => {
    setBusy(true)
    setError('')
    try {
      const k = loginKey.trim()
      await refresh(k)
      setKey(k)
      saveKey(k)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const logout = () => {
    setKey('')
    saveKey('')
    setAccount(undefined)
    setJustCreated(false)
    document.querySelector('[data-haltwise]')?.remove()
    ;(window as any).__haltwiseWidget = false
  }

  const shownKey = key || 'YOUR_API_KEY'

  return (
    <SiteLayout active="developers">
      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="section-head">
          <span className="eyebrow">For banks, fintechs and telcos</span>
          <h2>Connect Haltwise to your app or website.</h2>
          <p className="lead">
            Your customers never sign up to Haltwise: they keep using your app. You add Haltwise behind it, with one API call or one line of HTML. Start with a free sandbox key; in production it runs on
            infrastructure you control, on open NVIDIA Nemotron models.
          </p>
        </div>

        <div className="dev-grid">
          {/* account box */}
          <div className="card dev-account">
            {account ? (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="small muted">Signed in as</div>
                    <h3 style={{ marginTop: 2 }}>{account.org}</h3>
                    <div className="small muted">
                      {account.email} · {account.country} · <span className="pill accent">sandbox</span>
                    </div>
                  </div>
                  <button className="btn small" onClick={logout}>
                    Log out
                  </button>
                </div>
                <label className="label">Your API key {justCreated && <span className="pill amber">copy it now and keep it private</span>}</label>
                <div className="row">
                  <input className="input mono" readOnly value={key} onFocus={e => e.target.select()} />
                  <button className="btn small" onClick={() => navigator.clipboard?.writeText(key)}>
                    Copy
                  </button>
                </div>
                <div className="tiny faint" style={{ marginTop: 8 }}>
                  Your key is also your login: paste it on this page from any device. Sandbox limit: {usage?.limitPerMinute ?? 30} checks per minute · {usage?.checksSinceRestart ?? 0} checks since the
                  server last restarted.
                </div>
              </>
            ) : (
              <>
                <div className="seg" style={{ marginBottom: 14 }}>
                  <button className={mode === 'signup' ? 'on' : ''} onClick={() => (setMode('signup'), setError(''))}>
                    Sign up
                  </button>
                  <button className={mode === 'login' ? 'on' : ''} onClick={() => (setMode('login'), setError(''))}>
                    Log in
                  </button>
                </div>
                {mode === 'signup' ? (
                  <>
                    <h3>Get a free sandbox API key</h3>
                    <label className="label" htmlFor="dev-org">
                      Organisation
                    </label>
                    <input id="dev-org" className="input" placeholder="Example Bank" value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} />
                    <label className="label" htmlFor="dev-email">
                      Work email
                    </label>
                    <input id="dev-email" className="input" type="email" placeholder="you@bank.example" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    <label className="label" htmlFor="dev-country">
                      Country
                    </label>
                    <select id="dev-country" className="select" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}>
                      {COUNTRIES.map(([c, n]) => (
                        <option key={c} value={c}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy || !form.org || !form.email} onClick={signup}>
                      {busy ? <span className="spinner" /> : 'Create my sandbox key'}
                    </button>
                    <div className="tiny faint" style={{ marginTop: 8 }}>
                      Sandbox keys are free and instant. No card, no password. We don’t email you or store your details: they live inside the signed key itself.
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Log in with your API key</h3>
                    <label className="label" htmlFor="dev-key">
                      API key
                    </label>
                    <input id="dev-key" className="input mono" placeholder="hw_sandbox_…" value={loginKey} onChange={e => setLoginKey(e.target.value)} />
                    <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy || !loginKey.trim()} onClick={login}>
                      {busy ? <span className="spinner" /> : 'Log in'}
                    </button>
                  </>
                )}
                {error && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{error}</div>}
              </>
            )}
          </div>

          {/* how it fits */}
          <div className="col">
            <div className="card">
              <b>How a bank connects</b>
              <ol className="small muted" style={{ paddingInlineStart: 18, lineHeight: 1.7, marginBottom: 0 }}>
                <li>
                  <b style={{ color: 'var(--text)' }}>Messages and links:</b> call <code>POST /v1/check</code> from your app or SMS gateway, or drop the widget on your website.
                </li>
                <li>
                  <b style={{ color: 'var(--text)' }}>Payments:</b> before releasing an instant payment, send it to Sentinel; it returns release, pause-and-verify or hold. (In this demo, Sentinel runs in the
                  customer app; a public transfer endpoint is next on the roadmap.)
                </li>
                <li>
                  <b style={{ color: 'var(--text)' }}>Your team:</b> fraud officers work cases in the bank console, with the agent trace and audit log.
                </li>
                <li>
                  <b style={{ color: 'var(--text)' }}>Production:</b> deploy the same container in your own cloud with your own Nemotron endpoint, SSO for staff, and your core-banking data instead of the
                  sandbox.
                </li>
              </ol>
            </div>
            <div className="g3 dev-plans">
              <div className="card">
                <b>Sandbox</b>
                <div className="stat-big" style={{ fontSize: 24 }}>Free</div>
                <div className="small muted">Instant key · 30 checks/min · simulated accounts</div>
              </div>
              <div className="card">
                <b>Production</b>
                <div className="stat-big" style={{ fontSize: 24 }}>Per customer</div>
                <div className="small muted">Priced per active customer per month · your infrastructure</div>
              </div>
              <div className="card">
                <b>Open source</b>
                <div className="stat-big" style={{ fontSize: 24 }}>Apache-2.0</div>
                <div className="small muted">Audit it, host it, extend it</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="band">
        <section className="section" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="dev-grid">
            <ApiTester apiKey={key} />
            <Snippets origin={origin} apiKey={shownKey} />
          </div>
        </section>
      </div>

      <section className="section" style={{ paddingTop: 56 }}>
        <WidgetSection origin={origin} apiKey={key} />
      </section>
    </SiteLayout>
  )
}

function ApiTester({ apiKey }: { apiKey: string }) {
  const [text, setText] = useState('Your account will be suspended today. Verify now at http://secure-bank-login.xyz')
  const [lang, setLang] = useState('en')
  const [res, setRes] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setRes('')
    const t0 = performance.now()
    try {
      const r = await fetch('/v1/check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ text, lang }) })
      const j = await r.json()
      setRes(`HTTP ${r.status} · ${Math.round(performance.now() - t0)} ms\n\n${JSON.stringify(j, null, 2)}`)
    } catch (e) {
      setRes(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>Try the API</b>
        <code className="tiny">POST /v1/check</code>
      </div>
      {!apiKey && <div className="small muted" style={{ marginTop: 8 }}>Sign up or log in above to use your key.</div>}
      <textarea className="textarea" style={{ marginTop: 10 }} value={text} onChange={e => setText(e.target.value)} />
      <div className="row" style={{ marginTop: 10 }}>
        <select className="select" style={{ width: 130 }} value={lang} onChange={e => setLang(e.target.value)} aria-label="Language">
          {['en', 'es', 'ar', 'hi', 'ur'].map(l => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <button className="btn primary grow" disabled={!apiKey || busy || !text.trim()} onClick={run}>
          {busy ? <span className="spinner" /> : 'Send request'}
        </button>
      </div>
      {res && <pre className="code-out">{res}</pre>}
    </div>
  )
}

function Snippets({ origin, apiKey }: { origin: string; apiKey: string }) {
  const [tab, setTab] = useState<'curl' | 'js' | 'python'>('curl')
  const code = {
    curl: `curl -X POST ${origin}/v1/check \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Your parcel is held. Pay the fee: https://parcel-redeliver.icu", "lang": "en"}'`,
    js: `const res = await fetch("${origin}/v1/check", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: message, lang: "en" }),
})
const verdict = await res.json()
// verdict.verdict: "scam" | "suspicious" | "likely_safe"
// verdict.risk: 0-100, verdict.red_flags, verdict.explanation`,
    python: `import requests

r = requests.post(
    "${origin}/v1/check",
    headers={"Authorization": "Bearer ${apiKey}"},
    json={"text": message, "lang": "en"},
    timeout=30,
)
verdict = r.json()
print(verdict["verdict"], verdict["risk"], verdict["explanation"])`,
  }[tab]
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <b>Connect from your code</b>
        <a className="tiny" href="/v1/openapi.json" target="_blank" rel="noreferrer">
          OpenAPI spec ↗
        </a>
      </div>
      <div className="seg" style={{ marginTop: 10 }}>
        {(['curl', 'js', 'python'] as const).map(t => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'js' ? 'JavaScript' : t === 'python' ? 'Python' : 'cURL'}
          </button>
        ))}
      </div>
      <pre className="code-out">{code}</pre>
      <button className="btn small" onClick={() => navigator.clipboard?.writeText(code)}>
        Copy
      </button>
    </div>
  )
}

function WidgetSection({ origin, apiKey }: { origin: string; apiKey: string }) {
  const [lang, setLang] = useState('en')
  const [shown, setShown] = useState(false)
  const snippet = `<script src="${origin}/embed.js" data-key="${apiKey || 'YOUR_API_KEY'}" data-lang="${lang}" async></script>`
  const preview = () => {
    document.querySelector('[data-haltwise]')?.remove()
    ;(window as any).__haltwiseWidget = false
    document.querySelectorAll('script[data-hw-preview]').forEach(s => s.remove())
    const s = document.createElement('script')
    s.src = `/embed.js?v=${Date.now()}`
    s.dataset.key = apiKey
    s.dataset.lang = lang
    s.dataset.open = 'true'
    s.dataset.hwPreview = ''
    document.body.appendChild(s)
    setShown(true)
  }
  return (
    <div className="trust-split">
      <div>
        <span className="eyebrow">No-code option</span>
        <h2>Add “Check a message” to any website.</h2>
        <p className="lead">
          Paste one line before <code>&lt;/body&gt;</code>. A small button appears in the corner of your site; customers paste a suspicious text, email or link and get Haltwise’s verdict in their
          language. It runs in its own shadow DOM, so it never clashes with your styles.
        </p>
        <div className="row wrap" style={{ marginTop: 18 }}>
          <select className="select" style={{ width: 150 }} value={lang} onChange={e => setLang(e.target.value)} aria-label="Widget language">
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="ar">العربية</option>
            <option value="hi">हिन्दी</option>
            <option value="ur">اردو</option>
          </select>
          <button className="btn primary" disabled={!apiKey} onClick={preview}>
            {shown ? 'Reload preview' : 'Preview it on this page'}
          </button>
        </div>
        {!apiKey && <div className="small muted" style={{ marginTop: 8 }}>Get a sandbox key above to preview the widget.</div>}
        {shown && <div className="small muted" style={{ marginTop: 8 }}>The widget is open in the bottom corner of this page. Try pasting a scam text.</div>}
      </div>
      <div className="code-card" style={{ wordBreak: 'break-all' }}>
        <div className="k">&lt;!-- paste before &lt;/body&gt; --&gt;</div>
        <div>{snippet}</div>
        <button className="btn small" style={{ marginTop: 12 }} onClick={() => navigator.clipboard?.writeText(snippet)}>
          Copy
        </button>
      </div>
    </div>
  )
}
