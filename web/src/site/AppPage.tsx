import { CustomerApp } from '../customer/CustomerApp'
import { SiteLayout } from './Shell'

export function AppPage() {
  return (
    <SiteLayout active="app">
      <main className="app-page">
        <div className="guide">
          <span className="eyebrow">Customer app</span>
          <h1>You are the bank’s customer.</h1>
          <p className="lead">
            Everything the AI does here is live: real NVIDIA Nemotron models, real web searches. Only the bank account is a sandbox, so no real money moves. Open the{' '}
            <a href="#/bank" target="_blank" rel="noreferrer">
              bank console
            </a>{' '}
            in another tab to watch the agents work as you go.
          </p>

          <div className="scenario">
            <h3>
              <span className="pill red">1</span> The “safe account” call
            </h3>
            <ol>
              <li>
                Open <b>Call Guard</b> and answer <b>Yes</b>: the caller says they are your bank.
              </li>
              <li>
                Press <b>Play demo scam call</b>, or speak on speakerphone yourself. Watch the warnings appear.
              </li>
              <li>
                Go to <b>Send</b>, choose <b>Demo: “safe account”</b> and press <b>Continue</b>.
              </li>
              <li>The payment is held. Try it again in Español or العربية from the language menu.</li>
            </ol>
          </div>

          <div className="scenario">
            <h3>
              <span className="pill amber">2</span> Check a real message
            </h3>
            <ol>
              <li>
                Open <b>Check</b> and paste a text or email you actually received, or a link or phone number.
              </li>
              <li>
                Or upload a <b>screenshot</b>: the text is read on your device and the image is never uploaded.
              </li>
              <li>Red flags are quoted from the message itself, and web sources are cited.</li>
            </ol>
          </div>

          <div className="scenario">
            <h3>
              <span className="pill accent">3</span> “I’ve been scammed”
            </h3>
            <ol>
              <li>
                Open <b>Help</b>, describe what happened in any language, and pick your country.
              </li>
              <li>Haltwise freezes the card, blocks new payments, opens a dispute and finds the official place to report it, with sources.</li>
            </ol>
          </div>

          <div className="real-list">
            <div>
              <b>Live and real</b>
              Every AI decision (Nemotron on Nebius Token Factory), scam warnings and official reporting sites from the web (Tavily), and any message you paste.
            </div>
            <div>
              <b>Sandbox</b>
              The account, balance, payees and transfers. A real deployment connects to the bank’s own systems; a public demo must not touch real money.
            </div>
          </div>
        </div>
        <CustomerApp />
      </main>
    </SiteLayout>
  )
}
