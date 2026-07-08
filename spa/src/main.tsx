import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerStreamWorker } from './lib/stream-worker'

const LOG_PREFIX = '[Main]'

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const logMessage = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`
  
  if (data) {
    console.log(logMessage, data)
  } else {
    console.log(logMessage)
  }
}

// Register service worker for stream proxying
async function initializeApp() {
  log('INFO', 'Initializing ReelView application')
  
  try {
    log('INFO', 'Registering stream worker...')
    const workerStatus = await registerStreamWorker()
    
    if (workerStatus.registered && workerStatus.active) {
      log('INFO', 'Stream worker registered and active', {
        version: workerStatus.version
      })
    } else if (workerStatus.registered) {
      log('WARN', 'Stream worker registered but not yet active')
    } else {
      log('ERROR', 'Stream worker registration failed', {
        error: workerStatus.error
      })
    }
  } catch (error: any) {
    log('ERROR', 'Failed to initialize stream worker', {
      error: error.message,
      stack: error.stack
    })
  }
  
  log('INFO', 'Rendering React application')
  
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Start initialization
initializeApp()