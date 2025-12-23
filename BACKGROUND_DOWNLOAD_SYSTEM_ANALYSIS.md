# Background Download System Fix - Screen Lock & App Navigation

## Problem Analysis

Downloads are stopping when:
1. **Screen locks** - OS suspends app threads  
2. **User navigates away** - Window loses focus
3. **Doze mode activates** - Android aggressive battery saver

### Root Causes

**Android:**
- Currently uses `Thread.start()` in HLSDownloaderPlugin (runs in app process)
- WakeLock exists but is only `PARTIAL_WAKE_LOCK` (not enough)
- No foreground service protecting the download process
- App suspension kills the download thread

**Electron:**
- Downloads tied to main window/process
- No persistent queue when app is minimized

## Solution

### Android: Use DownloadService Foreground Service

The infrastructure already exists in `DownloadService.java` but needs integration.

**How to Implement:**

1. **Modify HLSDownloaderPlugin.startDownload():**
```java
@PluginMethod
public void startDownload(PluginCall call) {
    // ... existing code ...
    
    // CHANGE: Start download via Foreground Service instead of background thread
    Intent downloadIntent = new Intent(getContext(), DownloadService.class);
    downloadIntent.setAction("DOWNLOAD");
    downloadIntent.putExtra("downloadId", downloadId);
    downloadIntent.putExtra("url", url);
    downloadIntent.putExtra("quality", quality);
    downloadIntent.putExtra("filename", filename);
    
    // Start foreground service (survives screen lock & app backgrounding)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        getContext().startForegroundService(downloadIntent);
    } else {
        getContext().startService(downloadIntent);
    }
    
    // Keep the existing plugin callback mechanism for progress updates
    // DownloadService will bridge progress back to plugin via broadcast
}
```

2. **Add Broadcast Receiver for progress updates:**

The DownloadService needs to communicate progress back to the plugin via LocalBroadcastManager or shared preferences polling.

3. **Upgrade WakeLock in HLSDownloader:**

Change from `PARTIAL_WAKE_LOCK` to `FULL_WAKE_LOCK` + `SCREEN_BRIGHT_WAKE_LOCK` for critical downloads:

```java
// In HLSDownloader.initializeWakeLock()
wakeLock = powerManager.newWakeLock(
    PowerManager.PARTIAL_WAKE_LOCK |      // Keep CPU awake
    PowerManager.ACQUIRE_CAUSES_WAKEUP,   // Wake up if in doze
    "reelview:download"
);
```

### Electron: Persistent Download Queue

**Key changes needed:**

1. **Add IPC handler for resuming downloads on app restart:**
```typescript
// In electron/src/index.ts
ipcMain.handle('resume-pending-downloads', async (event) => {
  const pending = getDownloadsList().filter(d => 
    d.status === 'downloading' || d.status === 'fetching' || d.status === 'parsing'
  );
  
  for (const download of pending) {
    // Resume each pending download
    await resumeDownload(download.id, download.url, download.filePath);
  }
  
  return { resumed: pending.length };
});
```

2. **Call on app startup:**
```typescript
(async () => {
  await app.whenReady();
  // ... existing code ...
  
  // Resume any interrupted downloads
  await resumePendingDownloads();
})();
```

3. **Store download state more robustly:**
- Use app-specific storage directory
- Persist download progress every 10-30 seconds
- Track partially downloaded segments

## Implementation Steps

### Phase 1: Android (Critical)
1. ? Manifest already has foreground service permissions
2. ? DownloadService.java already exists
3. TODO: Integrate HLSDownloaderPlugin to use DownloadService
4. TODO: Add LocalBroadcastManager for progress communication
5. TODO: Test screen lock scenarios

### Phase 2: Electron (Important)  
1. Add persistent download queue
2. Add resume capability
3. Test app backgrounding

### Phase 3: Web (Nice to have)
1. Add Service Worker for background downloads
2. Add persistence via IndexedDB
3. Notify when resumable (if tab is reopened)

## Current Status

? **Already Implemented:**
- Android Manifest permissions
- DownloadService class (exists but unused)
- HLSDownloader WakeLock mechanism
- Download state persistence to SharedPreferences

? **Needs Implementation:**
- HLSDownloaderPlugin integration with DownloadService
- Progress communication back to plugin
- Electron download queue persistence
- Resume capability

## Testing Checklist

- [ ] Start Android download
- [ ] Lock screen - download continues
- [ ] Navigate away from app - download continues
- [ ] Reopen app - download still in progress
- [ ] Download completes successfully
- [ ] File appears in Downloads folder

## Commit Ready

Once implemented, commit as:
```
Background download system - survive screen lock and app navigation

- Android: integrate HLSDownloaderPlugin with DownloadService foreground service
- Electron: add persistent download queue and resume capability  
- Result: Downloads continue when screen locks or app backgrounded
```

---

**Next Action:** Integrate HLSDownloaderPlugin to use DownloadService for true background downloads
