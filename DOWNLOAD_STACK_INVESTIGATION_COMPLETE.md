# ?? DOWNLOAD STACK INVESTIGATION - COMPREHENSIVE ANALYSIS

**Date**: December 30, 2025
**Status**: Logging Added - Ready for Testing

---

## Problem Summary

The Android download system isn't functioning, while the Electron version works perfectly. I've traced the issue and added comprehensive logging to help debug.

---

## Root Cause Analysis

### Electron Download Stack (Working ?)
1. **Stream Capture**: Uses Electron's `session.webRequest.onBeforeRequest()` to intercept network requests
2. **Authentication**: Automatically includes session cookies via `net.request({ session: ses, useSessionCookies: true })`
3. **Data Flow**:
   - Network requests captured with full auth context
   - Variants parsed with auth headers applied
   - Download happens with session-authenticated connection
4. **Result**: Downloads work with authentication seamlessly

### Android Download Stack (Not Working ?)
1. **Stream Capture**: Uses Capacitor WebView (ReelViewWebViewClient.java)
2. **Authentication**: Uses basic `URLConnection` WITHOUT session/auth context
3. **Data Flow Problem**:
   ```
   Download Button ? getCapturedStreams() ? (EMPTY or wrong format)
   ? startDownload() ? No auth context ? Download fails
   ```
4. **Root Issues**:
   - `HLSDownloaderPlugin.java` receives streams but doesn't properly expose them
   - `getCapturedStreams()` may be returning empty array
   - Even if streams exist, no auth headers/cookies are passed
   - Basic `URLConnection` can't handle authenticated HLS streams

---

## Comparison: Data Structures

### Electron CapturedStream
```typescript
{
  url: string;           // Actual m3u8 URL
  type: 'hls';
  timestamp: number;
  content?: string;      // Stored for variants checking
  headers?: Record<string, string>;  // Auth headers
}
```

### Android CapturedStream (Current)
```java
{
  url: string;           // Should be m3u8 URL
  type: string;
  timestamp: long;
}
// Plus separate HashMap<String, JSONObject> streamHeadersCache
```

**Problem**: Headers are stored separately and not reliably passed through the download flow!

---

## Logging Added (Electron-Style Comprehensive)

### Frontend Logging (download-button.tsx)
```typescript
[Download] ========== DOWNLOAD START ==========
[Download] Platform: capacitor
[Download] ? Got API: function
[Download] Calling getCapturedStreams()...
[Download] ? getCapturedStreams returned: [...
[Download] Streams count: X
[Download]  [0] URL: https://...
[Download]  [0] Type: object
[Download] ? URL valid: https://...
[Download] Final filename: video_name
[Download] Calling startDownload with URL: https://...
[Download] ========== DOWNLOAD END ==========
```

This will show:
- Whether API is available ?
- Whether getCapturedStreams returns data ?
- What format the data is in ?
- What URL was extracted ?
- Whether startDownload succeeded ?

---

## Next Steps: Testing

### When Device Connects:
1. **Open Watch page** ? Play video for 3+ seconds
2. **Tap Download button**
3. **Check logcat** for `[Download]` tags:
   ```bash
   adb logcat | grep Download
   ```
4. **Check HLSDownloaderPlugin logs**:
   ```bash
   adb logcat | grep HLSDownloaderPlugin
   ```

### Expected Log Flow (Success)
```
[Download] Calling getCapturedStreams()...
[Download] ? getCapturedStreams returned: [Object {...}]
[Download] Streams count: 1
[Download] [0] URL: https://stream.example.com/playlist.m3u8
[Download] ? URL valid: https://stream.example.com/playlist.m3u8
[Download] Calling startDownload with URL: https://stream.example.com/playlist.m3u8
[Download] startDownload result: {success: true, downloadId: "dl-1735..."}
[Download] ? Download started successfully
```

### Expected Log Flow (Failure - Empty Streams)
```
[Download] Calling getCapturedStreams()...
[Download] ? getCapturedStreams returned: []
[Download] Streams count: 0
[Download] No streams initially, retrying 3 times...
[Download] Retry 1/3, waiting 500ms...
[Download] Retry 1 returned: []
[Download] Retry 2/3, waiting 500ms...
[Download] Retry 2 returned: []
[Download] Retry 3/3, waiting 500ms...
[Download] Retry 3 returned: []
[Download] ? Still no streams after retries
```

---

## Key Differences Between Stacks

| Aspect | Electron | Android |
|--------|----------|---------|
| **Stream Capture** | `session.webRequest.onBeforeRequest` | ReelViewWebViewClient (native) |
| **Auth Handling** | `net.request({useSessionCookies: true})` | Basic `URLConnection` |
| **Header Passing** | Via `net.request` options | Separate HashMap (unreliable) |
| **Variant Parsing** | Via `fetchWithSession()` (auth) | Via basic URLConnection (no auth) |
| **Download** | Segments fetched with auth | Segments fetched without auth |
| **Format** | M3U8 + segments | M3U8 + segments |
| **Result** | ? Works | ? Likely fails on auth |

---

## Critical Finding: Auth Headers Never Passed to Download

Looking at the Android flow:
1. ? `HLSDownloaderPlugin.storeCapturedStream()` accepts headers
2. ? Headers stored in `streamHeadersCache`
3. ? Headers cached in `getCapturedStreams()` response
4. ? **BUT**: `HLSDownloaderPlugin.startDownload()` doesn't accept headers!
5. ? **BUT**: `DownloadService` / actual downloader never gets headers!

**This is the smoking gun**: Headers are captured but never used.

---

## Files with Logging Added

### ? spa/src/components/video/download-button.tsx
- Added 40+ console.log statements
- Traces every step of the download flow
- Shows:
  - Platform detection
  - API availability
  - getCapturedStreams() response
  - Stream count and format
  - URL extraction
  - Filename generation
  - startDownload() result

---

## What to Do When Testing

### 1. Tap Download Button
Watch the logcat output in real-time:
```bash
adb logcat -c  # Clear previous logs
adb logcat | grep Download
```

### 2. If Streams = 0
This means:
- ReelViewWebViewClient isn't capturing streams properly
- OR the native stream capture system isn't working
- Need to check: ReelViewWebViewClient logs, is it being called?

### 3. If Streams > 0 But Download Fails
This means:
- Stream capture works
- Download service isn't authenticating properly
- Check: DownloadService logs, network errors

### 4. If Download Starts But Doesn't Complete
This means:
- Auth headers aren't being applied
- Download fails on protected segments
- Check: HLS segment download error logs

---

## Next Session: Fix Plan

Once we see the logs, we'll know exactly which part is broken:

1. **No streams captured** ? Fix ReelViewWebViewClient
2. **Streams exist but empty format** ? Fix getCapturedStreams() return format
3. **Download starts but fails** ? Add headers to DownloadService
4. **Segments fail to download** ? Apply headers in segment fetcher

---

## Summary

? Comprehensive logging added to trace download flow
? Compared Electron (working) to Android (not working)
? Identified critical difference: Auth headers not passed through
? APK ready to test - will show exact failure point

**When device connects, tap download and check logs. The output will immediately show where the problem is.**
