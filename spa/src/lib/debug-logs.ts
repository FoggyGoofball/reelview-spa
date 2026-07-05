/**
 * Debug Logging Utility
 * 
 * Provides functions to export overlay-neutralizer and ad-capture logs
 * for debugging when dev tools can't be used (cross-origin embed restrictions)
 */

declare global {
  interface Window {
    __OVERLAY_LOGS?: string[];
    __OVERLAY_DETECTED?: any[];
    __AD_CAPTURE_LOGS?: string[];
    __exportOverlayLogs?: () => string;
    __exportAdCaptureLogs?: () => string;
    __exportAllLogs?: () => string;
    __copyOverlayLogsToClipboard?: () => Promise<void>;
  }
}

/**
 * Initialize debug logs on window
 */
export function initializeDebugLogs() {
  if (typeof window === 'undefined') return;
  
  // Create log storage
  if (!window.__OVERLAY_LOGS) {
    window.__OVERLAY_LOGS = [];
  }
  if (!window.__OVERLAY_DETECTED) {
    window.__OVERLAY_DETECTED = [];
  }
  if (!window.__AD_CAPTURE_LOGS) {
    window.__AD_CAPTURE_LOGS = [];
  }
  
  // Export functions
  window.__exportOverlayLogs = function() {
    if (!window.__OVERLAY_LOGS) return 'No overlay logs';
    return window.__OVERLAY_LOGS.join('\n');
  };
  
  window.__exportAdCaptureLogs = function() {
    if (!window.__AD_CAPTURE_LOGS) return 'No ad capture logs';
    return window.__AD_CAPTURE_LOGS.join('\n');
  };
  
  window.__exportAllLogs = function() {
    const separator = '\n\n' + '='.repeat(80) + '\n\n';
    const overlayLogs = window.__exportOverlayLogs?.() || '';
    const adLogs = window.__exportAdCaptureLogs?.() || '';
    return overlayLogs + separator + adLogs;
  };
  
  window.__copyOverlayLogsToClipboard = async function() {
    const logs = window.__exportAllLogs?.();
    if (logs && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(logs);
        alert('? All logs copied to clipboard! Paste into a file.');
        return;
      } catch (e) {
        console.error('Failed to copy to clipboard:', e);
      }
    }
    // Fallback: show in console
    console.log('=== OVERLAY NEUTRALIZER LOGS ===');
    console.log(window.__exportOverlayLogs?.());
    console.log('\n=== AD CAPTURE LOGS ===');
    console.log(window.__exportAdCaptureLogs?.());
    console.log('\n=== DETECTED OVERLAYS ===');
    console.log(JSON.stringify(window.__OVERLAY_DETECTED, null, 2));
  };
  
  console.log('[DEBUG-LOGS] Initialized. Available functions:');
  console.log('  window.__exportOverlayLogs() - Get overlay neutralizer logs');
  console.log('  window.__exportAdCaptureLogs() - Get ad capture logs');
  console.log('  window.__exportAllLogs() - Get all logs');
  console.log('  window.__copyOverlayLogsToClipboard() - Copy all logs to clipboard');
}

/**
 * Add a log entry to overlay logs
 */
export function addOverlayLog(message: string) {
  if (typeof window !== 'undefined' && window.__OVERLAY_LOGS) {
    const timestamp = new Date().toISOString();
    window.__OVERLAY_LOGS.push(`[${timestamp}] ${message}`);
    
    // Keep last 500 logs
    if (window.__OVERLAY_LOGS.length > 500) {
      window.__OVERLAY_LOGS.shift();
    }
  }
}

/**
 * Add a log entry to ad-capture logs
 */
export function addAdCaptureLog(message: string) {
  if (typeof window !== 'undefined' && window.__AD_CAPTURE_LOGS) {
    const timestamp = new Date().toISOString();
    window.__AD_CAPTURE_LOGS.push(`[${timestamp}] ${message}`);
    
    // Keep last 500 logs
    if (window.__AD_CAPTURE_LOGS.length > 500) {
      window.__AD_CAPTURE_LOGS.shift();
    }
  }
}
