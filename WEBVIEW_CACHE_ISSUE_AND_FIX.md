# WEBVIEW CACHE BUG - Discovered & Workaround

## The Issue
Even though all source files contain the NEW hash (index-D9Wy0VnG.js), the Android WebView is still loading the OLD hash (index-TofgVzs1.js).

This is because:
1. Chromium WebView on Android caches localhost resources aggressively
2. Simply clearing app data doesn't clear WebView's internal cache
3. The cache persists across app reinstalls if WebView package isn't updated

## Immediate Workaround (Do This Now)

1. Restart your phone completely (power off/on)
2. Reinstall the APK: `adb install -r app-debug.apk`
3. Verify logcat shows new hash

OR

1. Uninstall the app: `adb uninstall com.reelview.app`
2. Clear WebView cache: `adb shell pm clear com.google.android.webview`
3. Reinstall: `adb install app-debug.apk`

## Permanent Solution: Capacitor Hard Cache Bust

Add this to `android/app/src/main/AndroidManifest.xml` in the `<application>` tag:

```xml
<!-- Disable WebView caching for localhost -->
<meta-data
    android:name="android.webkit.WebView.DisableProfileableSharedMemory"
    android:value="true" />
```

Add this to `MainActivity.java` in the `WebView` configuration:

```java
webView.getSettings().setAppCacheMaxSize(0);  // Disable app cache
webView.getSettings().setAppCacheEnabled(false);
webView.getSettings().setDatabaseEnabled(false);
webView.getSettings().setDomStorageEnabled(false);
webView.clearCache(true);
```

## Why This Happens

Capacitor serves `www/` folder as localhost. Android WebView's Chromium engine caches the index file. When the Vite build changes the hash, Chromium doesn't know to invalidate its cache because:
- The URL is still `http://localhost/assets/index-*.js`
- Chromium uses filename + timestamp, not content hash
- App cache persists across app restarts until explicitly cleared

## Testing Verification

After applying fix:
```powershell
adb logcat -c
# Now open app
adb logcat | Select-String "index-D9Wy0VnG"
# Should appear immediately
```

If it shows `index-TofgVzs1.js`, the WebView cache is still active.
