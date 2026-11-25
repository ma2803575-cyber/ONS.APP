import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AppProvider } from './store'
import { AudioProvider } from './audio'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter><AppProvider><AudioProvider><App /></AudioProvider></AppProvider></BrowserRouter>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Existing installs pick up a new service worker automatically: it activates at once and the page reloads one time.
  const hadController = !!navigator.serviceWorker.controller
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; window.location.reload() } })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
    }).catch(() => {})
  })
}
