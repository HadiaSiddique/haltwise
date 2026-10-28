import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './site.css'
import { CustomerApp } from './customer/CustomerApp'
import { CommandCenter } from './bank/CommandCenter'
import { Home } from './site/Home'
import { AppPage } from './site/AppPage'
import { SiteLayout } from './site/Shell'

const useHash = () => {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => {
    const on = () => setH(location.hash || '#/')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h
}

function App() {
  const h = useHash()
  if (h.startsWith('#/app')) return <AppPage />
  if (h.startsWith('#/bank'))
    return (
      <SiteLayout active="bank">
        <div className="console-page">
          <CommandCenter embedded />
        </div>
      </SiteLayout>
    )
  // Presenter view: phone and console side by side, for recording the demo video.
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
  return <Home />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
