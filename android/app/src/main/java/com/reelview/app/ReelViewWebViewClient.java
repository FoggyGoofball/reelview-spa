package com.reelview.app;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

public class ReelViewWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "ReelViewWebViewClient";
    private Bridge bridge;

    public ReelViewWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        
        // Capture HLS streams
        if (isHLSStream(url)) {
            Log.d(TAG, "HLS stream detected: " + url.substring(0, Math.min(100, url.length())));
            captureStreamUrl(url);
        }
        
        return super.shouldInterceptRequest(view, request);
    }
    
    /**
     * Check if URL is an HLS stream
     */
    private boolean isHLSStream(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        
        // Must have m3u8 extension or be from known HLS paths
        return lowerUrl.contains(".m3u8") ||
               lowerUrl.contains("/hls/") ||
               lowerUrl.contains("/playlist") ||
               lowerUrl.contains("/manifest");
    }
    
    /**
     * Send captured stream URL to the HLSDownloaderPlugin
     */
    private void captureStreamUrl(String url) {
        try {
            HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
            if (plugin != null) {
                plugin.captureStreamFromNative(url);
                Log.d(TAG, "Stream captured and sent to plugin");
            } else {
                Log.w(TAG, "HLSDownloaderPlugin not available");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error capturing stream: " + e.getMessage());
        }
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        
        MainActivity activity = (MainActivity) bridge.getActivity();
        if (activity == null) return;

        // On watch pages, inject a smart listener to disable timers on first interaction.
        // On other pages, we do not throttle timers.
        if (url != null && url.contains("/watch")) {
            String smartThrottleJs = 
                "(function() { " +
                "   if (window.timerListenerAttached) return; " +
                "   window.timerListenerAttached = true; " +
                "   const disableTimersWithDelay = () => { " +
                "       console.log('First user interaction on watch page. Disabling timers in 500ms.'); " +
                "       setTimeout(() => { " +
                "           console.log('Executing full timer block.'); " +
                "           window.setInterval = function() {}; " +
                "           window.setTimeout = function() {}; " +
                "       }, 500); " + // 500ms DELAY TO ALLOW POPUP SCRIPT TO FIRE
                "   }; " +
                "   document.addEventListener('click', disableTimersWithDelay, { once: true }); " +
                "})();";
            view.evaluateJavascript(smartThrottleJs, null);
        } 
    }
}
