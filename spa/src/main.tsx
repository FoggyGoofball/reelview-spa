import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// ============================================
// SECURITY SYSTEMS - INITIALIZE EARLY
// ============================================

import { initializeDebugLogs } from './lib/debug-logs'
initializeDebugLogs();

import { initializeAdCapture } from './lib/ad-capture'
import { initializeAndroidStreamDetector } from './lib/android-stream-detector'

console.log('[MAIN] Initializing security systems...');
try {
  initializeAdCapture();
  console.log('[MAIN] ? Ad Capture initialized');
} catch (err) {
  console.error('[MAIN] ? Ad Capture failed:', err);
}

try {
  initializeAndroidStreamDetector();
  console.log('[MAIN] ? Stream detector initialized');
} catch (err) {
  console.error('[MAIN] ? Stream detector failed:', err);
}

console.log('[MAIN] Security systems ready');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
