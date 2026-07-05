# Native Overlay Defense Implementation Plan for Reelview Android

## Executive Summary

Implement a **native Android WebViewClient interception system** combined with **strategic JavaScript injection** to defeat transparent click-intercepting overlays on embedded video players. This bypasses iframe sandbox restrictions and guarantees our defense code executes before overlay scripts.

**Target:** Zero user interruption, seamless ad blocking via jailing (not blocking), complete video control functionality.

---

## Phase 1: Architecture Analysis & Design

### Current Problem
- ? React error boundary triggers on Watch page (overlay-neutralizer crashes)
- ? JavaScript-only solutions fail due to iframe sandboxing
- ? Z-index manipulation doesn't work inside iframe context
- ? MutationObserver approach causes React crashes

### Root Cause
JavaScript running inside a sandboxed iframe has NO access to:
- Parent document z-index
- Cross-origin DOM manipulation
- External event listeners

**Solution:** Intercept at the **native Android level** BEFORE the iframe sandboxes the content.

### Three-Layer Defense

**Layer 1: Native WebViewClient Interception**
- Custom `ReelViewWebViewClient` extends `WebViewClient`
- Intercepts `shouldInterceptRequest()` for embed URLs
- Modifies HTML response before WebView renders it

**Layer 2: Strategic JavaScript Injection**
- Inject blocker script at document `<head>` start
- Executes BEFORE any embed overlay scripts
- First to register event listeners (captures clicks)

**Layer 3: Multi-Vector Defense Script**
- Overlay detection & neutralization
- window.open/location intercepts
- Ad jailing system
- Continuous MutationObserver monitoring

---

## Phase 2: Implementation Steps

### Step 1: Create Custom WebViewClient

**File:** `android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java`

```java
package com.reelview.app;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;

public class ReelViewWebViewClient extends WebViewClient {
    
    private static final String TAG = "ReelViewWebView";
    private static final String[] EMBED_DOMAINS = {
        "vidsrc.net", "vidsrc.me", "vidsrc.xyz",
        "vidlink.pro", "2embed.org", "2embed.to",
        "autoembed.to", "mostream.us", "godriveplayer.com"
    };
    
    @Override
    public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
        String url = request.getUrl().toString();
        
        // Check if this is an embed request
        if (isEmbedRequest(url)) {
            try {
                return interceptEmbedRequest(url);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to intercept embed: " + e.getMessage(), e);
            }
        }
        
        return super.shouldInterceptRequest(request);
    }
    
    private boolean isEmbedRequest(String url) {
        for (String domain : EMBED_DOMAINS) {
            if (url.contains(domain) && url.contains("embed")) {
                return true;
            }
        }
        return false;
    }
    
    private WebResourceResponse interceptEmbedRequest(String url) throws Exception {
        // Download original HTML from embed provider
        String originalHtml = fetchUrl(url);
        
        // Get our defense script
        String defenseScript = getDefenseScript();
        
        // Inject defense script at document start
        String injectedHtml = injectDefenseScript(originalHtml, defenseScript);
        
        android.util.Log.d(TAG, "Intercepted embed: " + url);
        android.util.Log.d(TAG, "Injected " + defenseScript.length() + " bytes of defense code");
        
        // Return modified HTML
        return new WebResourceResponse(
            "text/html",
            "utf-8",
            200,
            "OK",
            null,
            new ByteArrayInputStream(injectedHtml.getBytes(StandardCharsets.UTF_8))
        );
    }
    
    private String fetchUrl(String urlString) throws Exception {
        URL url = new URL(urlString);
        URLConnection connection = url.openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        
        BufferedReader reader = new BufferedReader(
            new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8)
        );
        
        StringBuilder html = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            html.append(line).append("\n");
        }
        reader.close();
        
        return html.toString();
    }
    
    private String getDefenseScript() {
        // Return the complete JavaScript defense code (see Phase 3)
        return DEFENSE_SCRIPT_CODE;
    }
    
    private String injectDefenseScript(String html, String script) {
        // Find opening head tag or html tag
        int headIndex = html.indexOf("<head>");
        if (headIndex < 0) {
            headIndex = html.indexOf("<html>");
            if (headIndex >= 0) {
                headIndex = html.indexOf(">", headIndex) + 1;
                return html.substring(0, headIndex) + 
                       "<head><script>" + script + "</script></head>" +
                       html.substring(headIndex);
            }
        } else {
            headIndex = html.indexOf(">", headIndex) + 1;
            return html.substring(0, headIndex) + 
                   "<script>" + script + "</script>" +
                   html.substring(headIndex);
        }
        
        // Fallback: prepend to document
        return "<head><script>" + script + "</script></head>" + html;
    }
    
    // Defense script will be inserted here (see Phase 3)
    private static final String DEFENSE_SCRIPT_CODE = "/* DEFENSE SCRIPT INJECTED HERE */";
}
```

### Step 2: Update MainActivity to Use Custom WebViewClient

**File:** `android/app/src/main/java/com/reelview/app/MainActivity.java`

Find the WebView initialization and add:

```java
// In onCreate() or configureWebView()
WebView webView = getBridge().getWebView();
webView.setWebViewClient(new ReelViewWebViewClient());

// Ensure JavaScript is enabled
WebSettings settings = webView.getSettings();
settings.setJavaScriptEnabled(true);
settings.setDomStorageEnabled(true);
settings.setDatabaseEnabled(true);
settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

// Allow cross-origin requests (needed for embed providers)
if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
}
```

### Step 3: Create Defense Script Module

**File:** `android/app/src/main/assets/defense-script.js`

This will be loaded and embedded in Java at build time.

```javascript
(function() {
  'use strict';
  
  // ============================================
  // LAYER 1: OVERLAY NEUTRALIZATION
  // ============================================
  
  function neutralizeOverlays() {
    var overlays = document.querySelectorAll('div');
    var count = 0;
    
    overlays.forEach(function(el) {
      try {
        var style = window.getComputedStyle(el);
        var rect = el.getBoundingClientRect();
        
        // Detection heuristics
        var isFixed = style.position === 'fixed' || style.position === 'absolute';
        var isLarge = rect.width >= window.innerWidth * 0.7 && 
                      rect.height >= window.innerHeight * 0.7;
        var isHighZ = parseInt(style.zIndex) > 100;
        var isTransparent = style.backgroundColor === 'transparent' || 
                           style.backgroundColor === 'rgba(0, 0, 0, 0)' ||
                           style.opacity < 0.1;
        
        // If it looks like an overlay
        if (isFixed && (isLarge || isHighZ) && isTransparent) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          count++;
        }
      } catch (e) {
        // Silently skip elements that cause errors
      }
    });
    
    if (count > 0) {
      console.log('[DEFENSE] Neutralized ' + count + ' overlay elements');
    }
  }
  
  // ============================================
  // LAYER 2: NAVIGATION INTERCEPTION
  // ============================================
  
  function jailAd(url) {
    try {
      var container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;' +
                                'width:1px;height:1px;visibility:hidden;' +
                                'pointer-events:none;z-index:-9999;overflow:hidden;';
      
      var iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.style.cssText = 'width:1px;height:1px;border:none;';
      iframe.src = url;
      
      container.appendChild(iframe);
      document.body.appendChild(container);
      
      console.log('[DEFENSE] Jailed ad: ' + url.substring(0, 80));
      
      // Auto-cleanup
      setTimeout(function() {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }, 600);
    } catch (e) {
      console.error('[DEFENSE] Error jailing ad:', e);
    }
  }
  
  function isSafeNavigation(url) {
    if (!url) return false;
    
    var safeOrigins = ['vidsrc', 'vidlink', '2embed', 'autoembed'];
    var lowerUrl = url.toLowerCase();
    
    // Allow same-origin
    if (lowerUrl.startsWith(window.location.origin)) return true;
    
    // Allow known safe embed providers
    for (var i = 0; i < safeOrigins.length; i++) {
      if (lowerUrl.includes(safeOrigins[i])) return true;
    }
    
    return false;
  }
  
  // Override window.open
  var originalOpen = window.open;
  window.open = function(url, target, features) {
    if (url && !isSafeNavigation(url)) {
      jailAd(url);
      return null;
    }
    return originalOpen.apply(window, arguments);
  };
  
  // Override location.assign
  var originalAssign = window.location.assign;
  window.location.assign = function(url) {
    if (!isSafeNavigation(url)) {
      jailAd(url);
      return;
    }
    return originalAssign.apply(window.location, [url]);
  };
  
  // Override location.replace
  var originalReplace = window.location.replace;
  window.location.replace = function(url) {
    if (!isSafeNavigation(url)) {
      jailAd(url);
      return;
    }
    return originalReplace.apply(window.location, [url]);
  };
  
  // Intercept link clicks
  document.addEventListener('click', function(e) {
    try {
      var link = e.target.closest('a');
      if (link && link.href && !isSafeNavigation(link.href)) {
        jailAd(link.href);
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    } catch (err) {
      // Silently ignore errors
    }
  }, true); // Capture phase
  
  // ============================================
  // LAYER 3: CONTINUOUS MONITORING
  // ============================================
  
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        setTimeout(neutralizeOverlays, 100);
      }
    });
  });
  
  // Start observing
  try {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
  } catch (e) {
    console.warn('[DEFENSE] MutationObserver failed:', e);
  }
  
  // Periodic re-check
  setInterval(neutralizeOverlays, 1000);
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Run once on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', neutralizeOverlays);
  } else {
    neutralizeOverlays();
  }
  
  console.log('[DEFENSE] Overlay defense system initialized');
})();
```

### Step 4: Embed Defense Script in Java

**Update:** `ReelViewWebViewClient.java`

Replace the `DEFENSE_SCRIPT_CODE` constant with the actual script:

```java
private static final String DEFENSE_SCRIPT_CODE = 
    "(function() { 'use strict'; " +
    "function neutralizeOverlays() { " +
    "var overlays = document.querySelectorAll('div'); " +
    "overlays.forEach(function(el) { " +
    "try { " +
    "var style = window.getComputedStyle(el); " +
    "var rect = el.getBoundingClientRect(); " +
    "var isFixed = style.position === 'fixed' || style.position === 'absolute'; " +
    "var isLarge = rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7; " +
    "var isHighZ = parseInt(style.zIndex) > 100; " +
    "var isTransparent = style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.opacity < 0.1; " +
    "if (isFixed && (isLarge || isHighZ) && isTransparent) { " +
    "el.style.setProperty('display', 'none', 'important'); " +
    "el.style.setProperty('pointer-events', 'none', 'important'); " +
    "el.style.setProperty('visibility', 'hidden', 'important'); " +
    "} } catch(e) {} }); } " +
    // ... continue with rest of script
```

Or better: **Load from assets at runtime:**

```java
private String getDefenseScript() {
    try {
        InputStream is = mContext.getAssets().open("defense-script.js");
        BufferedReader br = new BufferedReader(new InputStreamReader(is));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line).append("\n");
        }
        br.close();
        return sb.toString();
    } catch (Exception e) {
        android.util.Log.e(TAG, "Failed to load defense script", e);
        return "";
    }
}
```

### Step 5: Remove React-Level Overlay Neutralizer

**File:** `spa/src/pages/Watch.tsx`

Remove the overlay-neutralizer initialization:

```typescript
// DELETE THIS ENTIRE useEffect:
useEffect(() => {
  if (!playerUrl) return;
  const timer = setTimeout(() => {
    try {
      console.error('[WATCH PAGE] *** OVERLAY NEUTRALIZER INIT START ***');
      initializeOverlayNeutralizer();
      // ...
    } catch (error) {
      console.error('[WATCH PAGE] *** OVERLAY NEUTRALIZER FAILED ***:', error);
    }
  }, 500);
  return () => {
    clearTimeout(timer);
    try {
      stopOverlayNeutralizer();
    } catch (e) {}
  };
}, [playerUrl]);
```

Keep ad-capture (it's working and doesn't cause crashes):

```typescript
// KEEP ad-capture initialization in main.tsx
// It's working fine and doesn't interfere with React
```

---

## Phase 3: Integration Points

### Changes Required

| File | Change | Type |
|------|--------|------|
| `MainActivity.java` | Add custom WebViewClient | Modify |
| `ReelViewWebViewClient.java` | NEW: Create class | Create |
| `defense-script.js` | NEW: JavaScript defense | Create |
| `Watch.tsx` | Remove React overlay code | Modify |
| `main.tsx` | Keep ad-capture only | No change |
| `overlay-neutralizer.ts` | Mark as deprecated/remove | Delete |

### Build Configuration

**File:** `android/app/build.gradle`

No changes needed - assets are automatically copied.

### Capacitor Config

**File:** `capacitor.config.json`

No changes needed - custom WebViewClient works with Capacitor's WebView.

---

## Phase 4: Testing Strategy

### Test Checklist

- [ ] Build Android app with new WebViewClient
- [ ] Load watch page with vidsrc embed
- [ ] Verify no React error boundary triggers
- [ ] Click video area - controls respond (play/pause)
- [ ] Click on transparent overlay area - click passes through
- [ ] Verify in logcat: `[DEFENSE] Overlay defense system initialized`
- [ ] Verify overlay not visible but video plays
- [ ] Test internal navigation (next episode) - works
- [ ] Test external link click - jailed (no navigation)
- [ ] Fast repeated clicks - no lag
- [ ] Fullscreen toggle - works
- [ ] Keyboard controls (volume, seek) - work

### Expected Logcat Output

```
[DEFENSE] Overlay defense system initialized
[DEFENSE] Neutralized 3 overlay elements
[DEFENSE] Jailed ad: https://ads.example.com/...
```

### No React Errors Expected

The Watch page should render normally without triggering the error boundary.

---

## Phase 5: Advantages of This Approach

? **Bypasses iframe sandbox** - Interception happens before iframe creation
? **No React crashes** - Defense code is separate from React lifecycle  
? **Guaranteed execution** - Script runs first in document head
? **Silent ads** - Users never see popups, redirects, or dialogs
? **Works with all embeds** - Generic detection heuristics
? **Continuous monitoring** - Catches dynamic overlays
? **Zero user friction** - Seamless playback experience
? **Ad networks don't detect blocking** - Jailed iframes load normally
? **Video controls work** - Selective blocking, not full click blocking

---

## Phase 6: Build & Deploy

### Build Steps

```bash
# 1. Ensure Java files are in place
# android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java

# 2. Ensure JavaScript defense script exists
# android/app/src/main/assets/defense-script.js

# 3. Update MainActivity.java to use custom WebViewClient

# 4. Clean and build
cd android
./gradlew clean assembleDebug

# 5. Install
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 6. Test
adb logcat | grep DEFENSE
```

### Verification

```bash
# Check defense script is loading
adb logcat | grep "Overlay defense system initialized"

# Check overlays are being neutralized
adb logcat | grep "Neutralized.*overlay"

# Monitor for any errors
adb logcat | grep -E "ERROR|Exception|CRASH"
```

---

## Summary

This native-level approach:

1. **Intercepts embed HTML before rendering** - WebViewClient.shouldInterceptRequest()
2. **Injects defense code at document start** - Guaranteed first execution
3. **Neutralizes overlays** - Hides them without breaking embed logic
4. **Jails external navigation** - Lets ads load but prevents navigation
5. **Monitors for dynamic overlays** - MutationObserver + periodic check
6. **Works seamlessly with Capacitor** - No lifecycle conflicts
7. **Removes React-level hacks** - No error boundary triggers
8. **Maintains video control functionality** - Selective click blocking

**Status:** Ready to implement ??

