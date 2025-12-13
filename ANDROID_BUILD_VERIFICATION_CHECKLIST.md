# ANDROID BUILD VERIFICATION CHECKLIST

## ? What We Did

### 1. Clean Build
- [x] Gradle cache cleared (`./gradlew clean`)
- [x] Old APK uninstalled  
- [x] Fresh `assembleDebug` build completed
- [x] New APK installed

### 2. Code Verified
- [x] ReelViewWebViewClient.java has `injectStreamCaptureScript()` method
- [x] Method is called from `onPageFinished()`
- [x] JavaScript injection includes:
  - [x] Fetch API hook
  - [x] XMLHttpRequest hook
  - [x] DOM mutation observer
  - [x] Capacitor plugin bridge

### 3. Build Output
```
BUILD SUCCESSFUL in 11s
85 actionable tasks: 76 executed, 9 up-to-date
APK: app/build/outputs/apk/debug/app-debug.apk
Installation: Success
```

## ?? Expected Log Sequence

When you test the app, watch for this sequence in logcat:

### Step 1: Page Load
```
D/ReelViewWebViewClient: onPageFinished called for: https://reelview.localhost/watch/...
D/ReelViewWebViewClient: ? Stream capture script injected with Capacitor bridge
```

### Step 2: JavaScript Installed
```
[HLS-CAPTURE-JS] Stream capture interceptors installed
```
*(This comes from the console.log in the injected script)*

### Step 3: Stream Detected
```
[HLS-CAPTURE-JS] Captured: https://stream.example.com/v.m3u8
D/ReelViewWebViewClient: ? HLS stream MATCHED (URL pattern): https://...
D/HLSDownloaderPlugin: Captured stream (native): https://...
```
OR
```
D/HLSDownloaderPlugin: Captured stream (js): https://...
```
*(either method works)*

### Step 4: Download Request
```
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
D/HLSDownloaderPlugin:   Including stream: https://...
D/HLSDownloaderPlugin: getCapturedStreams returning 1 streams
```

### Result
? Quality dialog opens with options (1080p, 720p, etc.)

## ? If You Still See "No Streams"

### Check 1: Is JavaScript even running?
```bash
adb logcat Capacitor/Console:V | grep -i "hls"
```
Should show:
```
[HLS-CAPTURE-JS] Stream capture interceptors installed
```

If NOT present ? JavaScript injection failed

### Check 2: Are URLs being intercepted?
```bash
adb logcat ReelViewWebViewClient:D | grep "shouldInterceptRequest"
```
Should show lots of logs for each resource loaded.

If NOT present ? WebViewClient not properly initialized

### Check 3: Is plugin getting called?
```bash
adb logcat HLSDownloaderPlugin:D | grep "Captured stream"
```
Should show at least one stream capture log.

If NOT present ? Plugin not receiving streams

### Check 4: Is getCapturedStreams being called?
```bash
adb logcat HLSDownloaderPlugin:D | grep "getCapturedStreams called"
```
Should show when you click "Choose Quality".

If NOT present ? Frontend not calling the plugin method

## ?? Diagnostic Command

Run this to capture everything:
```bash
adb logcat > full_logcat.txt
# Then test on phone
# Then Ctrl+C
# Then analyze full_logcat.txt
```

Look for any ERROR or WARN logs from:
- ReelViewWebViewClient
- HLSDownloaderPlugin
- Capacitor

## ?? Success Indicators

| Indicator | Means |
|-----------|-------|
| JavaScript logs present | ? Injection works |
| URL pattern match logs | ? Stream detected |
| "Captured stream" logs | ? Plugin received it |
| getCapturedStreams logs | ? Frontend requested |
| Quality dialog appears | ? FULL SUCCESS |

## ?? Next Steps if Still Failing

1. **Check exact error in logcat**
   - Share any ERROR logs
   
2. **Verify phone has latest app**
   - `adb install -r app/build/outputs/apk/debug/app-debug.apk`
   
3. **Check specific video source**
   - Different sites (vidsrc, vidlink, etc.) may behave differently
   
4. **Check Capacitor plugin loading**
   - All Capacitor plugins must load before JavaScript can call them
   - There's a timing issue if JavaScript runs before plugin initializes

## ?? Current Status

- APK built: ? Yes
- APK installed: ? Yes  
- Code has JS capture: ? Yes
- Ready to test: ? Yes

**Test the app now and report what you see in logcat!**
