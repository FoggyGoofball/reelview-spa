# Android Download Stream Capture - Troubleshooting & Diagnosis Plan

## Root Cause Analysis: "No Streams Found"

The error occurs because `getCapturedStreams()` returns an empty array. This means either:
1. **ReelViewWebViewClient.shouldInterceptRequest()** is NOT being called
2. **shouldInterceptRequest()** IS being called but URLs DON'T MATCH the HLS detection patterns
3. **HLSDownloaderPlugin.getInstance()** returns null, so capture fails silently

## How to Diagnose (Step by Step)

### STEP 1: Install and Run Debug APK
```bash
# In Android Studio:
1. Click Run ? Run 'app' (or press Shift+F10)
2. Select your device/emulator
3. Wait for app to launch
```

### STEP 2: Open Logcat
```bash
# In Android Studio:
1. Click View ? Tool Windows ? Logcat
   OR use keyboard shortcut: Alt+6
2. At the bottom, you'll see a text filter field
3. Type: ReelViewWebViewClient
```

### STEP 3: Navigate to Video Page
```bash
In the app:
1. Click any "Movies" or "TV Shows"
2. Click any video title to enter Watch page
3. Check Logcat for logs
```

### STEP 4: Read the Logs

**Expected output if working:**
```
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://example.com/page.html
D/ReelViewWebViewClient: ? Not HLS stream: https://example.com/page.html
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://stream.example.com/playlist.m3u8
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://stream.example.com/playlist.m3u8
D/ReelViewWebViewClient: Stream captured and sent to plugin
D/HLSDownloaderPlugin: Captured stream (native): https://stream.example.com/playlist.m3u8
```

**If you DON'T see any "shouldInterceptRequest" logs:**
- Problem: WebViewClient.shouldInterceptRequest() is NOT being called
- Cause: WebViewClient might not be properly set, or the bridge isn't initialized
- Solution: Check MainActivity.onStart() and configureWebView()

**If you see "shouldInterceptRequest" but NO "? HLS stream MATCHED":**
- Problem: URL patterns don't match
- Cause: The m3u8 URL format from your streaming source is different
- Solution: 
  1. Look at the "? Not HLS stream" URLs
  2. Find the actual m3u8 URL pattern
  3. Add it to isHLSStream() method

**If you see stream matched but NO "Captured stream" log:**
- Problem: HLSDownloaderPlugin.getInstance() is null
- Cause: Plugin failed to load or initialize
- Solution: Check if @CapacitorPlugin annotation is present on HLSDownloaderPlugin

### STEP 5: Click Download Button
```bash
In logcat:
1. Filter for: HLSDownloaderPlugin
2. Click Download button ? Choose Quality
3. Check if getCapturedStreams is called
```

**Expected log:**
```
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
D/HLSDownloaderPlugin:   Including stream: https://stream.example.com/playlist.m3u8
D/HLSDownloaderPlugin: getCapturedStreams returning 1 streams
```

**If you see "Current count: 0":**
- The capture from step 4 didn't work
- Go back and check why stream wasn't captured

## Common Solutions

### Solution 1: URL Pattern Not Recognized
The m3u8 URL from your source doesn't match any pattern in `isHLSStream()`.

**How to find the actual URL:**
1. Look at the "? Not HLS stream" logs in logcat
2. Find one that contains `.m3u8` or looks like a stream
3. Copy the pattern

**How to add it:**
Edit `ReelViewWebViewClient.java`, method `isHLSStream()`:
```java
private boolean isHLSStream(String url) {
    if (url == null) return false;
    String lowerUrl = url.toLowerCase();
    
    return lowerUrl.contains(".m3u8") ||
           lowerUrl.contains("/hls/") ||
           lowerUrl.contains("/playlist") ||
           lowerUrl.contains("/manifest") ||
           lowerUrl.contains("/pl/") ||
           lowerUrl.contains("/master.") ||
           lowerUrl.contains("stream") && lowerUrl.contains("m3u") ||
           lowerUrl.contains("YOUR_NEW_PATTERN");  // <-- ADD HERE
}
```

### Solution 2: WebViewClient Not Set
If you see NO "shouldInterceptRequest" logs at all.

**Check MainActivity.configureWebView():**
```java
private void configureWebView(WebView webView) {
    // ... settings ...
    
    // These MUST be here:
    bridge.getWebView().setWebChromeClient(new ReelViewWebChromeClient(bridge));
    bridge.getWebView().setWebViewClient(new ReelViewWebViewClient(bridge));
}
```

**Check MainActivity.onStart():**
```java
@Override
public void onStart() {
    super.onStart();
    if (bridge != null && bridge.getWebView() != null) {
        configureWebView(bridge.getWebView());
    }
}
```

### Solution 3: Plugin Instance Null
The capture happens but plugin doesn't receive it.

**Check HLSDownloaderPlugin:**
1. Class must have `@CapacitorPlugin(name = "HLSDownloader")` annotation ?
2. Method `load()` must set `instance = this;` ?
3. Method `getInstance()` must return `instance` ?

All are correct in current code.

## Quick Checklist

- [ ] App installed via Android Studio
- [ ] Logcat window open, filtered for ReelViewWebViewClient
- [ ] Navigated to video page
- [ ] See "shouldInterceptRequest" logs?
  - [ ] YES ? See "? HLS stream MATCHED"?
    - [ ] YES ? See "Captured stream" log?
      - [ ] YES ? Download works, no issue!
      - [ ] NO ? Plugin instance is null
    - [ ] NO ? Add URL pattern to isHLSStream()
  - [ ] NO ? WebViewClient not set in MainActivity

## Next Steps

1. Run app-debug.apk
2. Share the logcat output showing what you see
3. We'll identify exactly what's different from the working APK

## File References

- `android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java` - Stream interception
- `android/app/src/main/java/com/reelview/app/HLSDownloaderPlugin.java` - Stream capture  
- `android/app/src/main/java/com/reelview/app/MainActivity.java` - WebViewClient setup
- Build: `android/app/build/outputs/apk/debug/app-debug.apk`
