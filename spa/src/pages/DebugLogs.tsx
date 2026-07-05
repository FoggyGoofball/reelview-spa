/**
 * Debug Logs Page Component
 * 
 * Shows overlay-neutralizer and ad-capture logs in a viewable format
 * Navigate to /debug-logs to see this page
 */

import { useEffect, useState } from 'react';

export default function DebugLogsPage() {
  const [overlayLogs, setOverlayLogs] = useState<string>('Loading...');
  const [detectedOverlays, setDetectedOverlays] = useState<any[]>([]);
  const [adCaptureLogs, setAdCaptureLogs] = useState<string>('No logs yet');

  useEffect(() => {
    // Retrieve logs from window object
    if (typeof window !== 'undefined') {
      // Get overlay logs
      const logs = (window as any).__exportOverlayLogs?.() || 'No logs available';
      setOverlayLogs(logs);

      // Get detected overlays
      const detected = (window as any).__OVERLAY_DETECTED || [];
      setDetectedOverlays(detected);

      // Get ad capture logs
      const adLogs = (window as any).__exportAdCaptureLogs?.() || 'No ad capture logs';
      setAdCaptureLogs(adLogs);
    }
  }, []);

  const handleExportLogs = () => {
    const allLogs = `
=== OVERLAY NEUTRALIZER LOGS ===
${overlayLogs}

=== DETECTED OVERLAYS (${detectedOverlays.length} items) ===
${JSON.stringify(detectedOverlays, null, 2)}

=== AD CAPTURE LOGS ===
${adCaptureLogs}
    `.trim();

    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(allLogs).then(() => {
        alert('? All logs copied to clipboard!');
      });
    } else {
      // Fallback: show in alert
      alert(allLogs);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">?? Debug Logs</h1>

        {/* Export Button */}
        <button
          onClick={handleExportLogs}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded mb-8 font-bold"
        >
          ?? Copy All Logs to Clipboard
        </button>

        {/* Detected Overlays */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">?? Detected Overlays ({detectedOverlays.length})</h2>
          {detectedOverlays.length > 0 ? (
            <div className="bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
              <pre className="text-sm text-green-400">
                {JSON.stringify(detectedOverlays, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-gray-400">No overlays detected yet. Play a video to trigger detection.</p>
          )}
        </section>

        {/* Overlay Neutralizer Logs */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">?? Overlay Neutralizer Logs</h2>
          <div className="bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="text-sm text-yellow-400 whitespace-pre-wrap break-words">
              {overlayLogs}
            </pre>
          </div>
        </section>

        {/* Ad Capture Logs */}
        <section>
          <h2 className="text-2xl font-bold mb-4">?? Ad Capture Logs</h2>
          <div className="bg-gray-900 p-4 rounded overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="text-sm text-cyan-400 whitespace-pre-wrap break-words">
              {adCaptureLogs}
            </pre>
          </div>
        </section>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-900 rounded">
          <h3 className="font-bold mb-2">?? How to Use:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Go back and play a video to trigger overlay detection</li>
            <li>Try to click the overlay</li>
            <li>Return to this page</li>
            <li>Click "Copy All Logs to Clipboard"</li>
            <li>Paste into a text editor to review the logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
