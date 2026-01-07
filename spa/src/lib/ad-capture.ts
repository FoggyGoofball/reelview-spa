/**
 * Ad Capture System - LOGGING ONLY
 * 
 * NOTE: All navigation interception is handled at native level via defense-script.js
 * This module provides logging/debugging capabilities only.
 * 
 * Do NOT enable window.open, location.assign, location.replace, or click interception here
 * as that would conflict with native defense-script.js interception.
 */

export interface AdCaptureConfig {
  enableLogging: boolean;
}

const defaultConfig: AdCaptureConfig = {
  enableLogging: true,
};

let config: AdCaptureConfig = { ...defaultConfig };

function log(...args: any[]) {
  if (config.enableLogging) {
    console.log('[AD_CAPTURE]', ...args);
    
    if (typeof window !== 'undefined' && (window as any).__AD_CAPTURE_LOGS) {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      (window as any).__AD_CAPTURE_LOGS.push(`[${timestamp}] [AD_CAPTURE] ${message}`);
      
      if ((window as any).__AD_CAPTURE_LOGS.length > 500) {
        (window as any).__AD_CAPTURE_LOGS.shift();
      }
    }
  }
}

function logImportant(event: string, details: any) {
  if (config.enableLogging) {
    const message = typeof details === 'object' ? JSON.stringify(details) : String(details);
    console.log(`[AD_CAPTURE] *** IMPORTANT ***: ${event}: ${message}`);
  }
}

/**
 * Initialize the Ad Capture logging system (LOGGING ONLY - NO INTERCEPTION)
 */
export function initializeAdCapture(userConfig?: Partial<AdCaptureConfig>) {
  config = { ...defaultConfig, ...userConfig };
  
  log('?'.repeat(60));
  log('Ad Capture - LOGGING MODE ONLY');
  log('Navigation interception handled by native defense-script.js');
  log('?'.repeat(60));
  
  if (typeof window === 'undefined') return;
  
  // Initialize logging array
  if (!((window as any).__AD_CAPTURE_LOGS)) {
    (window as any).__AD_CAPTURE_LOGS = [];
  }
  
  // Listen for native ad blocking events (from defense-script.js logs)
  const interval = setInterval(() => {
    // Monitor console for defense-script logs
    // This is passive logging only - no active interception
  }, 5000);
  
  // Clean up on unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
  }, { once: true });
  
  log('? Ad Capture logging initialized (PASSIVE MODE)');
  logImportant('AD_CAPTURE_READY', {
    mode: 'LOGGING_ONLY',
    navigationInterception: 'HANDLED_BY_NATIVE',
    message: 'All ad blocking happens via native defense-script.js',
  });
}

/**
 * Cleanup (no-op since we're not doing active interception)
 */
export function cleanupAdCapture() {
  log('Ad Capture cleanup called (no-op in logging mode)');
}
