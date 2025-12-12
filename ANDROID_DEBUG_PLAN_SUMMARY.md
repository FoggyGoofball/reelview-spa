# Android "No Streams Found" - Debug Plan Summary

## Problem
When clicking Download ? "Choose Quality", you get "No streams captured" error instead of stream variants.

## Root Cause
The JavaScript frontend isn't receiving captured HLS streams from the native Android layer.

## What We Added

### 1. Enhanced Logging (ReelViewWebViewClient.java)
Every URL loaded in the WebView is now logged:
- ? Not HLS stream: `https://...` (non-stream URLs)
- ? HLS stream MATCHED: `https://.../playlist.m3u8` (captured streams)

### 2. Capture Status Logging (HLSDownloaderPlugin.java)
When the download dialog opens:
- Shows current count of captured streams
- Lists each captured URL
- Shows how many streams are returned to JavaScript

### 3. Debug APK
Built with `./gradlew assembleDebug` - includes all logging

## How to Debug Now

### Quick Start (5 minutes)
```bash
1. Run app-debug.apk in Android Studio
2. View ? Tool Windows ? Logcat (or Alt+6)
3. Search for: ReelViewWebViewClient
4. Go to any video page
5. Look at the logs - see if m3u8 URLs are captured
```

### Detailed Steps
See: `ANDROID_STREAM_CAPTURE_TROUBLESHOOTING.md`

## Expected Log Output

**When navigating to video (should see):**
```
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://page.com/html
D/ReelViewWebViewClient: ? Not HLS stream: https://page.com/html
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://stream.com/v.m3u8
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://stream.com/v.m3u8
D/ReelViewWebViewClient: Stream captured and sent to plugin
D/HLSDownloaderPlugin: Captured stream (native): https://stream.com/v.m3u8
```

**When clicking "Choose Quality" (should see):**
```
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
D/HLSDownloaderPlugin:   Including stream: https://stream.com/v.m3u8
D/HLSDownloaderPlugin: getCapturedStreams returning 1 streams
```

## Most Likely Issues

1. **URL pattern not recognized**
   - Fix: Add pattern to `isHLSStream()` method
   - Clue: See "? Not HLS stream" for the actual URL

2. **WebViewClient not initialized**
   - Fix: Check MainActivity.configureWebView()
   - Clue: No "shouldInterceptRequest" logs at all

3. **Plugin instance is null**
   - Fix: Verify @CapacitorPlugin annotation
   - Clue: Stream matched but no capture log

## Files Modified
- `android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java`
- `android/app/src/main/java/com/reelview/app/HLSDownloaderPlugin.java`

## Build Command
```bash
cd android
./gradlew clean assembleDebug
```

## Install & Test
```bash
# In Android Studio: Run ? Run 'app'
# Or: adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Next Actions

1. ? Build app-debug.apk with logging
2. ?? **YOU**: Run the app and check logcat
3. ?? **YOU**: Share the log output
4. ?? **ME**: Identify exact issue and fix

## References

- Troubleshooting Guide: `ANDROID_STREAM_CAPTURE_TROUBLESHOOTING.md`
- Debug Guide: `ANDROID_DOWNLOAD_DEBUG_GUIDE.md`
- Current Source: See commit `cf068a4`
