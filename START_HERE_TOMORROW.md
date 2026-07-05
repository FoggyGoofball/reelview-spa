# ?? START HERE - Tomorrow Morning

**This is your checklist. Follow these steps exactly.**

---

## Step 1: Launch App (1 minute)

1. Open Reelview app on your Android device
2. Verify home page loads with movie/TV/anime content
3. If blank screen, see TROUBLESHOOTING at bottom

---

## Step 2: Navigate to Watch Page (1 minute)

1. From home, tap any movie or TV show
2. Tap "Watch Now" or similar button
3. Video should start playing
4. **IMPORTANT**: Let it play for a few seconds (stream needs to be captured)

---

## Step 3: Verify Cast Button Exists (30 seconds)

1. Look at the **TOP RIGHT** of the video player
2. You should see two buttons:
   - **Download** (down arrow icon)
   - **Cast** (TV icon) ? THIS IS WHAT WE'RE TESTING
3. If you DON'T see it:
   - See TROUBLESHOOTING section
   - It should definitely be there

---

## Step 4: Test Device Discovery (3 minutes)

1. **TAP the Cast button** (TV icon)
2. **WATCH**: A dialog/picker should appear showing devices
3. **EXPECTED OUTPUT**:
   - List of Chromecast devices found on your network
   - Device name (e.g., "Living Room", "Bedroom Chromecast")

### If device picker DOES appear:
- ? **Continue to Step 5**

### If device picker DOESN'T appear:
- ? **See TROUBLESHOOTING section**
- Check: Google Play Services installed? Same WiFi? Chromecast powered on?

---

## Step 5: Select Device and Cast (2 minutes)

1. **SELECT** your Chromecast device from the list
2. **WAIT**: Browser should open showing the intermediary website
3. **WATCH**: Video should start playing on your TV

### If video DOES play on TV:
- ? **CHROMECAST WORKS!**
- Continue to Step 6

### If video DOESN'T play:
- ? **See TROUBLESHOOTING section**

---

## Step 6: Verify Auth Headers (2 minutes)

This proves the authentication system is working.

1. **OPEN** the browser that's showing the intermediary website
2. **PRESS**: F12 (open developer tools)
3. **CLICK**: Console tab
4. **LOOK FOR** these messages:
   ```
   [HH:MM:SS] Chromecast Intermediary Ready
   [HH:MM:SS] Parsed headers from URL
   [HH:MM:SS] XHR request to ... with X headers
   ```

### If you see those messages:
- ? **AUTH HEADERS WORKING!**
- Check Network tab - segments should load without 401 errors

### If you DON'T see those messages:
- ?? Headers might not have been included
- Check the intermediary URL has `&headers=<json>` parameter

---

## Step 7: Document Results

If everything worked, write down:
- ? Cast button appeared
- ? Device picker opened
- ? Selected device
- ? Video played on TV
- ? Auth headers shown in console

If something failed, write down:
- ? What step failed
- ? What error appeared
- ? Screenshot if possible

---

## TROUBLESHOOTING

### Cast button doesn't appear
- **Check**: App version in Settings > About
- **Solution**: Close app, clear cache, reopen
- **If still missing**: App might need rebuild (see Rebuild section)

### Device picker doesn't open
- **Check**: Is Chromecast powered on?
- **Check**: Is phone on same WiFi as Chromecast?
- **Check**: Google Play Services installed? (Settings > Apps > Google Play Services)
- **Check**: Check logcat for errors: `adb logcat | grep ChromecastPlugin`

### Video starts but doesn't play
- **Check**: URL in browser address bar
- **Check**: Video element loaded (F12 > Elements)
- **Check**: HLS.js loaded (F12 > Network, search for "hls.js")
- **Check**: Console for errors (F12 > Console)

### Auth headers not showing
- **Check**: Browser console (F12 > Console)
- **Check**: Intermediary URL has `?url=` AND `&headers=` parameters
- **Check**: Headers are valid JSON (no quotes errors)
- **Solution**: Headers might be empty - make sure stream was captured

### Completely broken - need to rebuild

```bash
# Full rebuild (takes ~35 seconds)
cd C:\Users\Admin\Downloads\reelview

# 1. Rebuild SPA (~25 sec)
cd spa
npm run build

# 2. Sync to Android (~1 sec)
cd ..
Remove-Item www\* -Recurse -Force
Copy-Item spa\dist\* www -Recurse -Force
npx cap sync android

# 3. Build APK (~6 sec)
cd android
.\gradlew.bat assembleDebug

# 4. Install
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 5. Test again
```

---

## SUCCESS CRITERIA

| Metric | Expected | Status |
|--------|----------|--------|
| Cast button visible | Yes | ? |
| Device picker opens | Yes | ? |
| Device selection works | Yes | ? |
| Intermediary website loads | Yes | ? |
| Video plays on TV | Yes | ? |
| Auth headers injected | Yes | ? |
| No auth errors (401) | Yes | ? |

If all checked ?: **CHROMECAST NATIVE IMPLEMENTATION SUCCESSFUL**

---

## SUMMARY

This tests the complete Chromecast implementation:

1. **Native Plugin** ? Sends stream URL + auth headers
2. **Intermediary Website** ? Receives headers, injects into HLS requests
3. **Chromecast Device** ? Receives stream with auth and plays it

**Everything is in place. You just need to test it.**

Good luck! ??
