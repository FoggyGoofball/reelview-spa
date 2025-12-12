# Android Download Debugging Guide - Stream Capture

## Quick Logcat Commands

### Option 1: Real-time logs in Android Studio
1. Build and install the debug APK in Android Studio
2. Open View ? Tool Windows ? Logcat (or click the Logcat tab at bottom)
3. Search/filter for these tags:
   - `ReelViewWebViewClient` - Shows URL interception
   - `HLSDownloaderPlugin` - Shows stream capture

### Option 2: Command-line with ADB
```bash
# Show all logs for our components
adb logcat ReelViewWebViewClient:D HLSDownloaderPlugin:D -v threadtime

# Or save to file for later analysis
adb logcat ReelViewWebViewClient:D HLSDownloaderPlugin:D -v threadtime > logcat.txt
```

## What to Look For

### When navigating to a video:
You should see logs like:
```
D/ReelViewWebViewClient: shouldInterceptRequest called for: https://example.com/...
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://stream.example.com/playlist.m3u8
D/ReelViewWebViewClient: Stream captured and sent to plugin
D/HLSDownloaderPlugin: Captured stream (native): https://stream.example.com/playlist.m3u8
```

### When clicking "Choose Quality":
You should see:
```
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
D/HLSDownloaderPlugin:   Including stream: https://stream.example.com/playlist.m3u8
D/HLSDownloaderPlugin: getCapturedStreams returning 1 streams
```

## If You See "NO CAPTURED STREAMS"

This means the m3u8 URL is NOT being intercepted. Possible causes:

1. **URL pattern not recognized** - The isHLSStream() method doesn't match the URL
   - Look for the ? Not HLS stream log
   - Check if the URL contains one of these patterns:
     - `.m3u8`
     - `/hls/`
     - `/playlist`
     - `/manifest`
     - `/pl/`
     - `/master.`
   
2. **shouldInterceptRequest() not called at all** - The WebViewClient isn't properly set
   - Look in MainActivity.java to verify configureWebView() is called
   - Check that ReelViewWebViewClient is set on the WebView
   
3. **Plugin instance is null** - HLSDownloaderPlugin.getInstance() returns null
   - The plugin may not have loaded properly
   - Check for load errors in logcat

## Test Steps

1. **Install app-debug.apk** from Android Studio
2. **Open Logcat** in Android Studio (View ? Tool Windows ? Logcat)
3. **Filter for** `ReelViewWebViewClient` and `HLSDownloaderPlugin`
4. **Navigate to a video** and check for interception logs
5. **Click Download button** ? "Choose Quality" and check for getCapturedStreams logs
6. **Share the relevant logcat output** if debugging needed

## File Locations

- Logging added to: `android/app/src/main/java/com/reelview/app/ReelViewWebViewClient.java`
- Logging added to: `android/app/src/main/java/com/reelview/app/HLSDownloaderPlugin.java`
- Build output: `android/app/build/outputs/apk/debug/app-debug.apk`
