/**
 * Auto-Log Exporter
 * 
 * Automatically writes overlay-neutralizer and ad-capture logs to localStorage
 * and provides a way to retrieve them via adb
 */

declare global {
  interface Window {
    __AUTO_EXPORT_LOGS?: () => void;
  }
}

export function initializeAutoLogExport() {
  if (typeof window === 'undefined') return;

  // Auto-export logs every 5 seconds to localStorage
  const exportInterval = setInterval(() => {
    try {
      const overlayLogs = (window as any).__OVERLAY_LOGS || [];
      const detectedOverlays = (window as any).__OVERLAY_DETECTED || [];
      const adCaptureLogs = (window as any).__AD_CAPTURE_LOGS || [];

      if (overlayLogs.length > 0 || adCaptureLogs.length > 0) {
        // Store in localStorage
        localStorage.setItem(
          'REELVIEW_OVERLAY_LOGS',
          JSON.stringify({
            timestamp: new Date().toISOString(),
            overlayLogs,
            detectedOverlays,
            adCaptureLogs,
            totalLogs: overlayLogs.length + adCaptureLogs.length,
          })
        );

        console.log(
          `[AUTO-EXPORT] Exported ${overlayLogs.length} overlay logs + ${detectedOverlays.length} detected overlays`
        );
      }
    } catch (e) {
      console.error('[AUTO-EXPORT] Error exporting logs:', e);
    }
  }, 5000); // Every 5 seconds

  // Make function available to call manually
  (window as any).__AUTO_EXPORT_LOGS = () => {
    try {
      const data = localStorage.getItem('REELVIEW_OVERLAY_LOGS');
      if (data) {
        const parsed = JSON.parse(data);
        console.log('=== EXPORTED LOGS ===');
        console.log(JSON.stringify(parsed, null, 2));
        return parsed;
      } else {
        console.log('No logs in localStorage yet');
        return null;
      }
    } catch (e) {
      console.error('Error retrieving logs:', e);
      return null;
    }
  };

  // Clean up on unload
  window.addEventListener(
    'beforeunload',
    () => clearInterval(exportInterval),
    { once: true }
  );

  console.log('[AUTO-EXPORT] Auto-log export initialized - logs saved every 5 seconds to localStorage');
}
