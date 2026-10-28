import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { CustomerApp } from './customer/CustomerApp'
import { CommandCenter } from './bank/CommandCenter'
import { Brand, DemoTag } from './components'

const useHash = () => {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setH(location.hash || '#/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h
}

function Landing() {
  return (
    <div className="landing">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Brand />
        <div className="row">
          <DemoTag label="All bank data is simulated" />
          <a className="btn small" href="https://github.com/HadiaSiddique/haltwise" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
      <div className="hero">
        <span className="pill accent">Open NVIDIA Nemotron models · Nebius Token Factory · Tavily</span>
        <h1 style={{ marginTop: 16 }}>
          Stop the scam <em>at the moment of payment.</em>
        </h1>
        <p>
          Haltwise is open-model AI that any bank, fintech or telco can own. It pauses risky transfers, listens for scam tactics on live calls, explains payee checks in the customer's own language,
          and helps victims recover. The AI can only brake. It can never move money.
        </p>
      </div>
      <div className="tiles">
        <a className="tile" href="#/demo">
          <span className="pill green">Best for judging</span>
          <h3 style={{ marginTop: 10 }}>Live demo: customer + bank side by side</h3>
          <div className="small muted">Phone on the left, Command Center on the right, agent trace streaming live.</div>
        </a>
        <a className="tile" href="#/app">
          <h3>Customer app</h3>
          <div className="small muted">Send money (Zelle, Faster Payments, SEPA Instant, UPI, Raast, M-Pesa), check a message, Live Call Guard, "I've been scammed". EN · ES · AR · HI · UR.</div>
        </a>
        <a className="tile" href="#/bank">
          <h3>Bank Command Center</h3>
          <div className="small muted">Case queue, agent trace, holds, mule check on incoming credits, Scam Radar, audit log, benchmark.</div>
        </a>
      </div>
      <div className="stat-strip">
        <div className="card">
          <b>~$16B</b>
          <span className="small muted">US fraud losses reported to the FTC in 2025, a record. Bank impersonators caused the highest reported losses.</span>
        </div>
        <div className="card">
          <b>Shared liability</b>
          <span className="small muted">UK APP reimbursement (since Oct 2024): sending and receiving banks split the cost of authorised push payment scams.</span>
        </div>
        <div className="card">
          <b>Verification of Payee</b>
          <span className="small muted">Mandatory for eurozone banks under the EU Instant Payments Regulation from 9 Oct 2025.</span>
        </div>
      </div>
      <p className="tiny faint" style={{ marginTop: 24 }}>Sources are listed in DEVPOST.md. Haltwise is a hackathon prototype. No real customer data is used.</p>
    </div>
  )
}

function App() {
  const h = useHash()
  if (h.startsWith('#/app')) return <CustomerApp full />
  if (h.startsWith('#/bank')) return <CommandCenter />
  if (h.startsWith('#/demo'))
    return (
      <div className="split">
        <div className="phone-wrap">
          <CustomerApp />
        </div>
        <div className="cc-wrap">
          <CommandCenter />
        </div>
      </div>
    )
  return <Landing />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
