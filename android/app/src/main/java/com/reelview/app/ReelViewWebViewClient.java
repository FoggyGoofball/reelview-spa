package com.reelview.app;

import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class ReelViewWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "ReelViewWebViewClient";
    private Bridge bridge;

    public ReelViewWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    private boolean isLikelyAdUrl(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        return lowerUrl.contains("doubleclick") ||
               lowerUrl.contains("googlesyndication") ||
               lowerUrl.contains("googleadservices") ||
               lowerUrl.contains("adnxs") ||
               lowerUrl.contains("taboola") ||
               lowerUrl.contains("outbrain") ||
               lowerUrl.contains("popads") ||
               lowerUrl.contains("propeller") ||
               lowerUrl.contains("trafficjunky") ||
               lowerUrl.contains("/ads/") ||
               lowerUrl.contains("/ad/") ||
               lowerUrl.contains("ad.") ||
               lowerUrl.contains("ads.");
    }

    private boolean isInternalAppUrl(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        return lowerUrl.startsWith("https://localhost") ||
               lowerUrl.startsWith("http://localhost") ||
               lowerUrl.startsWith("capacitor://localhost") ||
               lowerUrl.startsWith("file:///android_asset/") ||
               lowerUrl.startsWith("about:blank") ||
               lowerUrl.startsWith("data:");
    }

    private boolean shouldBlockNavigation(WebView view, String url, boolean isMainFrame) {
        if (url == null || url.isEmpty()) return false;

        if (isLikelyAdUrl(url)) {
            Log.w(TAG, "[AD-JAIL] Blocked likely ad navigation: " + url.substring(0, Math.min(120, url.length())));
            return true;
        }

        // Global rule: never allow non-internal URLs to navigate inside app WebView.
        // They should be jailed/suppressed instead of opening externally.
        if (!isInternalAppUrl(url)) {
            Log.w(TAG, "[AD-JAIL] Blocked non-internal navigation: " + url.substring(0, Math.min(120, url.length())) +
                    " (isMainFrame=" + isMainFrame + ")");
            return true;
        }

        return false;
    }

    private void jailUrlInPage(WebView view, String url) {
        if (view == null || url == null || url.isEmpty()) return;
        try {
            String escaped = url.replace("\\", "\\\\").replace("'", "\\'");
            String js =
                "(function(){" +
                "  try {" +
                "    if (window.__reelviewJailExternal) { window.__reelviewJailExternal('" + escaped + "'); return; }" +
                "    var c=document.createElement('div');" +
                "    c.style.cssText='position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;pointer-events:none;z-index:-9999;opacity:0;';" +
                "    var i=document.createElement('iframe');" +
                "    i.style.cssText='width:1px;height:1px;border:none;visibility:hidden;pointer-events:none;';" +
                "    i.setAttribute('sandbox','allow-scripts');" +
                "    i.src='" + escaped + "';" +
                "    c.appendChild(i);" +
                "    if (document.body) document.body.appendChild(c);" +
                "    setTimeout(function(){ if(c.parentNode) c.parentNode.removeChild(c); }, 600);" +
                "  } catch(e) {}" +
                "})();";
            view.evaluateJavascript(js, null);
        } catch (Exception e) {
            Log.e(TAG, "Error jailing URL in page: " + e.getMessage());
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        try {
            String url = request != null && request.getUrl() != null ? request.getUrl().toString() : "";
            boolean isMainFrame = request == null || request.isForMainFrame();

            if (shouldBlockNavigation(view, url, isMainFrame)) {
                jailUrlInPage(view, url);
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "shouldOverrideUrlLoading(request) error: " + e.getMessage());
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        try {
            if (shouldBlockNavigation(view, url, true)) {
                jailUrlInPage(view, url);
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "shouldOverrideUrlLoading(url) error: " + e.getMessage());
        }
        return super.shouldOverrideUrlLoading(view, url);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();
        
        // CRITICAL: Capture HLS streams AND their request headers
        if (isHLSStream(url)) {
            Log.d(TAG, "?? HLS stream detected: " + url.substring(0, Math.min(100, url.length())));
            
            // Extract ALL headers from the network request
            Map<String, String> headers = new HashMap<>(request.getRequestHeaders());
            
            // Log headers for debugging
            Log.d(TAG, "  Captured " + headers.size() + " request headers");
            for (String key : headers.keySet()) {
                String value = headers.get(key);
                if (value != null && value.length() > 200) {
                    Log.d(TAG, "    " + key + ": " + value.substring(0, 100) + "... [TRUNCATED]");
                } else {
                    Log.d(TAG, "    " + key + ": " + value);
                }
            }
            
            // Pass stream URL and headers to plugin
            captureStreamWithHeaders(url, headers);
        }
        
        // ? CRITICAL: Intercept embed provider HTML and inject ad-blocker
        // Check if this is a request to an embed provider (the key is the URL, not the Accept header)
        if (isEmbedProvider(url)) {
            Log.d(TAG, "??? Embed provider detected: " + url.substring(0, Math.min(100, url.length())));
            WebResourceResponse response = injectBlockerIntoEmbed(request, url);
            if (response != null) {
                return response;
            }
        }
        
        return super.shouldInterceptRequest(view, request);
    }
    
    /**
     * Check if URL is from a video embed provider that needs ad blocking
     */
    private boolean isEmbedProvider(String url) {
        if (url == null) return false;
        String lowerUrl = url.toLowerCase();
        return lowerUrl.contains("vidsrc") ||
               lowerUrl.contains("vidlink") ||
               lowerUrl.contains("play.xpass.top") ||
               lowerUrl.contains("xpass.top") ||
               lowerUrl.contains("2embed") ||
               lowerUrl.contains("autoembed") ||
               lowerUrl.contains("vidcloud") ||
               lowerUrl.contains("vidplay") ||
               lowerUrl.contains("filemoon") ||
               lowerUrl.contains("streamwish") ||
               lowerUrl.contains("doodstream") ||
               lowerUrl.contains("upstream") ||
               lowerUrl.contains("mixdrop") ||
               lowerUrl.contains("mp4upload") ||
               lowerUrl.contains("streamsb") ||
               lowerUrl.contains("streamtape");
    }
    
    /**
     * Intercept embed provider HTML and inject our ad-blocker script
     */
    private WebResourceResponse injectBlockerIntoEmbed(WebResourceRequest request, String url) {
        try {
            Log.d(TAG, "??? Intercepting embed for ad-blocking: " + url.substring(0, Math.min(80, url.length())));
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod(request.getMethod());
            
            // Copy request headers
            for (Map.Entry<String, String> entry : request.getRequestHeaders().entrySet()) {
                connection.setRequestProperty(entry.getKey(), entry.getValue());
            }
            
            connection.connect();
            
            int responseCode = connection.getResponseCode();
            String contentType = connection.getContentType();
            
            // Only inject into HTML responses
            if (contentType != null && contentType.contains("text/html")) {
                InputStream input = connection.getInputStream();
                byte[] buffer = new byte[8192];
                StringBuilder html = new StringBuilder();
                int bytesRead;
                while ((bytesRead = input.read(buffer)) != -1) {
                    html.append(new String(buffer, 0, bytesRead, StandardCharsets.UTF_8));
                }
                input.close();
                
                String htmlContent = html.toString();
                String blocker = getBlockerScript();
                
                // Inject blocker script at the very beginning
                String injectedHtml;
                if (htmlContent.contains("<head>")) {
                    injectedHtml = htmlContent.replace("<head>", "<head><script>" + blocker + "</script>");
                } else {
                    injectedHtml = "<!DOCTYPE html><html><head><script>" + blocker + "</script></head>" + htmlContent;
                }
                
                Log.d(TAG, "? Blocker script injected into embed HTML");
                
                return new WebResourceResponse(
                    "text/html",
                    "utf-8",
                    responseCode,
                    "OK",
                    null,
                    new ByteArrayInputStream(injectedHtml.getBytes(StandardCharsets.UTF_8))
                );
            }
            
            // Not HTML, return null to let default handling continue
            connection.disconnect();
            return null;
            
        } catch (Exception e) {
            Log.e(TAG, "Error injecting blocker: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * The ad-blocker and overlay neutralizer script
     * This is injected into embed provider HTML pages
     */
    private String getBlockerScript() {
        return "(function() {" +
            "console.log('[REELVIEW-BLOCKER] Initializing...');" +
            "var adJails = [];" +
            "" +
            "function isAllowedUrl(u) {" +
            "  if (!u) return false;" +
            "  var url = String(u).toLowerCase();" +
            "  // Allow only trusted/internal navigation" +
            "  if (url.startsWith('about:blank')) return true;" +
            "  if (url.startsWith('https://localhost') || url.startsWith('http://localhost')) return true;" +
            "  if (url.startsWith('capacitor://localhost')) return true;" +
            "  if (url.startsWith('#')) return true;" +
            "  if (url.includes('imdb.com') || url.includes('themoviedb.org') || url.includes('thetvdb.com')) return true;" +
            "  return false;" +
            "}" +
            "" +
            "function isLikelyAdUrl(u) {" +
            "  if (!u) return false;" +
            "  var url = String(u).toLowerCase();" +
            "  return url.includes('doubleclick') || url.includes('googlesyndication') || url.includes('googleadservices') ||" +
            "         url.includes('adnxs') || url.includes('taboola') || url.includes('outbrain') ||" +
            "         url.includes('popads') || url.includes('propeller') || url.includes('/ads/') || url.includes('/ad/') ||" +
            "         url.includes('ad.') || url.includes('ads.');" +
            "}" +
            "" +
            "function jailAd(u) {" +
            "  if (!u) return;" +
            "  console.log('[REELVIEW-BLOCKER] Jailing:', u);" +
            "  var c = document.createElement('div');" +
            "  c.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;visibility:hidden;pointer-events:none;z-index:-9999;opacity:0;';" +
            "  var i = document.createElement('iframe');" +
            "  i.style.cssText = 'width:1px;height:1px;border:none;visibility:hidden;pointer-events:none;';" +
            "  i.setAttribute('sandbox', 'allow-scripts');" +
            "  i.setAttribute('allow', 'autoplay');" +
            "  i.src = String(u);" +
            "  c.appendChild(i);" +
            "  if (document.body) document.body.appendChild(c);" +
            "  setTimeout(function() {" +
            "    try {" +
            "      var d = i.contentDocument;" +
            "      if (d) {" +
            "        var media = d.querySelectorAll('video,audio');" +
            "        media.forEach(function(m){ try{ m.muted = true; m.volume = 0; m.pause && m.pause(); } catch(_){} });" +
            "      }" +
            "    } catch(_) {}" +
            "  }, 50);" +
            "  setTimeout(function() { if (c.parentNode) c.parentNode.removeChild(c); }, 600);" +
            "}" +
            "window.__reelviewJailExternal = jailAd;" +
            "" +
            "var __rvOrigOpen = window.open ? window.open.bind(window) : null;" +
            "window.open = function(u, t, f) {" +
            "  if (isAllowedUrl(u) && __rvOrigOpen) return __rvOrigOpen(u, t, f);" +
            "  if (!isAllowedUrl(u) || isLikelyAdUrl(u)) { jailAd(u); return null; }" +
            "  return null;" +
            "};" +
            "" +
            "// Block location changes" +
            "var origAssign = window.location.assign;" +
            "window.location.assign = function(u) {" +
            "  if (isAllowedUrl(u)) return origAssign.call(window.location, u);" +
            "  jailAd(u);" +
            "};" +
            "" +
            "var origReplace = window.location.replace;" +
            "window.location.replace = function(u) {" +
            "  if (isAllowedUrl(u)) return origReplace.call(window.location, u);" +
            "  jailAd(u);" +
            "};" +
            "" +
            "// Block link clicks" +
            "document.addEventListener('click', function(e) {" +
            "  var l = e.target.closest('a');" +
            "  if (l && l.href) {" +
            "    if (!isAllowedUrl(l.href)) {" +
            "      console.log('[REELVIEW-BLOCKER] Blocking link click:', l.href);" +
            "      jailAd(l.href);" +
            "      e.preventDefault();" +
            "      e.stopPropagation();" +
            "      e.stopImmediatePropagation();" +
            "      return false;" +
            "    }" +
            "  }" +
            "}, true);" +
            "" +
            "// Run overlay neutralizer" +
            "neutralizeOverlays();" +
            "setInterval(neutralizeOverlays, 1000);" +
            "" +
            "// Watch for new elements" +
            "if (document.body) {" +
            "  var obs = new MutationObserver(function() { setTimeout(neutralizeOverlays, 100); });" +
            "  obs.observe(document.body, { childList: true, subtree: true });" +
            "} else {" +
            "  document.addEventListener('DOMContentLoaded', function() {" +
            "    var obs = new MutationObserver(function() { setTimeout(neutralizeOverlays, 100); });" +
            "    obs.observe(document.body, { childList: true, subtree: true });" +
            "  });" +
            "}" +
            "" +
            "console.log('[REELVIEW-BLOCKER] Active - blocking all non-allowed navigation');" +
            "})();";
    }
    
    /**
     * Capture stream URL along with its request headers
     */
    private void captureStreamWithHeaders(String url, Map<String, String> headers) {
        try {
            HLSDownloaderPlugin plugin = HLSDownloaderPlugin.getInstance();
            
            if (plugin != null) {
                // Capture the stream URL
                plugin.captureStreamFromNative(url);
                
                // Store the headers for this URL so download service can use them
                ReelViewWebViewClient.storeHeaders(url, headers);
                
                Log.d(TAG, "? Stream captured with " + headers.size() + " headers: " + url.substring(0, Math.min(80, url.length())));
            } else {
                Log.w(TAG, "? HLSDownloaderPlugin not yet available, queuing stream");
                PendingStreamCapture.queueStream(url);
                // Still store headers for when plugin loads
                ReelViewWebViewClient.storeHeaders(url, headers);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error capturing stream: " + e.getMessage(), e);
        }
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
               lowerUrl.contains("/manifest") ||
               lowerUrl.contains("/pl/") ||           // Common playlist path
               lowerUrl.contains("/master.") ||       // Master playlist
               lowerUrl.contains("stream") && lowerUrl.contains("m3u");  // Various stream patterns
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        
        // Inject JavaScript to capture streams at the network level
        // This catches streams that shouldInterceptRequest might miss
        if (url != null && url.contains("/watch")) {
            injectStreamCaptureScript(view);
        }
        
        MainActivity activity = (MainActivity) bridge.getActivity();
        if (activity == null) return;

        // On watch pages, inject a smart listener to disable timers on first interaction.
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
                "       }, 500); " +
                "   }; " +
                "   document.addEventListener('click', disableTimersWithDelay, { once: true }); " +
                "})();";
            view.evaluateJavascript(smartThrottleJs, null);
        } 
    }
    
    /**
     * Inject JavaScript to capture streams via Fetch/XHR interception
     * This is the third capture method - catches streams shouldInterceptRequest misses
     */
    private void injectStreamCaptureScript(WebView view) {
        String captureScript = 
            "(function() {" +
            "  if (window.__hlsCaptureInstalled) return;" +
            "  window.__hlsCaptureInstalled = true;" +
            "" +
            "  function captureStream(url) {" +
            "    if (url && (url.includes('.m3u8') || url.includes('/pl/') || url.includes('/hls/') || url.includes('/manifest'))) {" +
            "      console.log('[HLS-CAPTURE-JS] Captured:', url.substring(0, 100));" +
            "      if (window.Capacitor) {" +
            "        window.Capacitor.Plugins.HLSDownloader.captureStream({ url: url }).catch(() => {});" +
            "      }" +
            "    }" +
            "  }" +
            "" +
            "  // Capture fetch requests" +
            "  const originalFetch = window.fetch;" +
            "  window.fetch = function(...args) {" +
            "    const url = args[0];" +
            "    const urlStr = typeof url === 'string' ? url : url.url;" +
            "    captureStream(urlStr);" +
            "    return originalFetch.apply(this, args);" +
            "  };" +
            "" +
            "  // Capture XMLHttpRequest" +
            "  const originalXhrOpen = XMLHttpRequest.prototype.open;" +
            "  XMLHttpRequest.prototype.open = function(method, url, ...args) {" +
            "    captureStream(url);" +
            "    return originalXhrOpen.apply(this, [method, url, ...args]);" +
            "  };" +
            "" +
            "  // Capture src attribute changes on video/audio elements" +
            "  const observer = new MutationObserver(function(mutations) {" +
            "    mutations.forEach(function(mutation) {" +
            "      if (mutation.target.tagName === 'SOURCE') {" +
            "        captureStream(mutation.target.src);" +
            "      }" +
            "    });" +
            "  });" +
            "" +
            "  observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['src'] });" +
            "  console.log('[HLS-CAPTURE-JS] Stream capture interceptors installed');" +
            "})();";
        
        try {
            view.evaluateJavascript(captureScript, null);
            Log.d(TAG, "? Stream capture script injected");
        } catch (Exception e) {
            Log.e(TAG, "Error injecting capture script: " + e.getMessage());
        }
    }
    
    // ============================================
    // STATIC HEADER STORAGE (accessed by HLSDownloaderPlugin)
    // ============================================
    
    private static final java.util.Map<String, java.util.Map<String, String>> streamHeaders = 
        new java.util.concurrent.ConcurrentHashMap<>();
    
    public static void storeHeaders(String url, java.util.Map<String, String> headers) {
        if (url != null && headers != null) {
            streamHeaders.put(url, new HashMap<>(headers));
            Log.d(TAG, "[HEADERS] Stored " + headers.size() + " headers for: " + url.substring(0, Math.min(80, url.length())));
        }
    }
    
    /**
     * Get headers for URL with fuzzy matching
     * 
     * FIX #2: Use URL prefix matching instead of exact match
     * 
     * Problem: URL parameters change (tokens, timestamps, etc)
     * So exact match fails: 
     *   Captured: https://example.com/video.m3u8?token=abc123
     *   Requested: https://example.com/video.m3u8?token=xyz789
     * Result: No match ? no headers ? 403 error
     *
     * Solution: Match on URL prefix (up to first ?)
     * Captured and Requested both match: https://example.com/video.m3u8
     * Result: Headers found ? 200 OK
     */
    public static java.util.Map<String, String> getHeaders(String url) {
        if (url == null || url.isEmpty()) {
            return new HashMap<>();
        }
        
        // ? Try exact match first
        java.util.Map<String, String> headers = streamHeaders.get(url);
        if (headers != null && !headers.isEmpty()) {
            Log.d(TAG, "[HEADERS] Found exact match - Retrieved " + headers.size() + " headers");
            return new HashMap<>(headers);
        }
        
        // ? Try prefix matching (FIX #2: fuzzy match for URL parameters)
        String urlPrefix = getUrlPrefix(url);
        Log.d(TAG, "[HEADERS] No exact match for: " + url.substring(0, Math.min(80, url.length())));
        Log.d(TAG, "[HEADERS] Trying prefix match: " + urlPrefix);
        
        // Search for any stored URL with same prefix
        for (String storedUrl : streamHeaders.keySet()) {
            String storedPrefix = getUrlPrefix(storedUrl);
            
            // ? If prefixes match, use these headers
            if (storedPrefix.equals(urlPrefix)) {
                headers = streamHeaders.get(storedUrl);
                if (headers != null && !headers.isEmpty()) {
                    Log.d(TAG, "[HEADERS] ? Prefix match found! Retrieved " + headers.size() + " headers");
                    Log.d(TAG, "[HEADERS]   Stored:   " + storedUrl.substring(0, Math.min(80, storedUrl.length())));
                    Log.d(TAG, "[HEADERS]   Requested: " + url.substring(0, Math.min(80, url.length())));
                    return new HashMap<>(headers);
                }
            }
        }
        
        // ? No match found anywhere
        Log.w(TAG, "[HEADERS] ? No headers found (exact or prefix match)");
        Log.w(TAG, "[HEADERS]   This may cause 403 Forbidden from protected streams");
        Log.w(TAG, "[HEADERS]   Make sure to play the video first to capture headers");
        
        return new HashMap<>();
    }
    
    /**
     * Extract URL prefix (base URL without query parameters)
     * 
     * Examples:
     * "https://example.com/video.m3u8?token=abc" ? "https://example.com/video.m3u8"
     * "https://example.com/hls/stream.ts" ? "https://example.com/hls/stream.ts"
     */
    private static String getUrlPrefix(String url) {
        if (url == null) return "";
        
        int queryIndex = url.indexOf('?');
        if (queryIndex > 0) {
            return url.substring(0, queryIndex);
        }
        return url;
    }
    
    public static void clearHeaders() {
        streamHeaders.clear();
        Log.d(TAG, "[HEADERS] All headers cleared");
    }
}
