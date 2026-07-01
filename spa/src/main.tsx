import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { startKeepAlive } from './lib/keep-alive'
import './styles.css'

// Start keep-alive pings to prevent Render.com cold starts.
// Only runs in production (when VITE_API_BASE_URL is set).
// Pings randomly every 7-14 minutes to keep the server warm.
if (import.meta.env.VITE_API_BASE_URL) {
  startKeepAlive();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
