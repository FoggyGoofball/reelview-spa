# APK Installation - Quick Start

**Status:** ? APK Built Successfully  
**APK:** `C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk` (15.17 MB)  
**Date:** January 12, 2026

---

## INSTALLATION METHOD 1: Batch Script (Easiest)

**File:** `install-reelview-final.bat`

1. **Connect device via USB**
2. **Enable USB Debugging:**
   - Settings ? Developer Options ? USB Debugging (ON)
   - Accept the USB debugging permission dialog
3. **Run the script:**
   ```
   double-click install-reelview-final.bat
   ```
4. **Follow the prompts**

---

## INSTALLATION METHOD 2: PowerShell Script

**File:** `install-reelview-final.ps1`

**Run from PowerShell:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
. .\install-reelview-final.ps1
```

**With options:**
```powershell
# Uninstall old version first
.\install-reelview-final.ps1 -Uninstall

# Skip confirmations
.\install-reelview-final.ps1 -Force
```

---

## INSTALLATION METHOD 3: Manual ADB Commands

**Open PowerShell and run:**

```powershell
# Set ADB path
$adb = "C:\Android\sdk\platform-tools\adb.exe"

# Check device
& $adb devices

# Install APK
& $adb install -r "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"

# Launch app
& $adb shell am start -n "com.reelview.app/.MainActivity"

# View logs
& $adb logcat -s ChromecastPlugin
```

---

## TROUBLESHOOTING

### Device Not Showing in `adb devices`
- Reconnect USB cable
- Unlock device
- Check Developer Options ? USB Debugging is ON
- Approve USB debugging dialog
- Run: `adb kill-server` then `adb devices` again

### Installation Fails with "Cannot find package"
```powershell
# Uninstall old version first
$adb uninstall com.reelview.app

# Then install again
$adb install -r "<apk-path>"
```

### "Permission denied" or "Insufficient storage"
```powershell
# Clear old data
$adb shell pm clear com.reelview.app

# Or uninstall and reinstall
$adb uninstall com.reelview.app
$adb install "<apk-path>"
```

### App crashes on launch
- Check logs: `adb logcat -s "ReelView|CAST|Chromecast"`
- Verify device has Google Play Services
- Try uninstalling and reinstalling

---

## WHAT'S NEW IN THIS BUILD

? **Chromecast Receiver:** Moved from localhost to GitHub Pages  
? **URL:** `https://foggygoofball.github.io/reelview-final/chromecast-receiver.html`  
? **Code:** ChromecastPlugin.java updated and tested  
? **Syntax:** All Java compilation errors fixed  
? **Removed:** CastProxyServer.java (no longer needed)  

---

## TESTING AFTER INSTALLATION

Once app is running on device:

```powershell
# View Chromecast logs
adb logcat -s ChromecastPlugin

# Check for Cast button appearing
adb logcat | Select-String "Cast button\|Chromecast available"

# Test cast functionality
# 1. Play a video
# 2. Click Cast button
# 3. Select Chromecast device
# 4. Verify receiver loads from GitHub Pages
```

---

## USEFUL COMMANDS

```powershell
# View device info
adb shell getprop ro.build.version.release  # Android version
adb shell getprop ro.product.model           # Device model

# View app info
adb shell dumpsys package com.reelview.app | grep -i "versionName\|versionCode"

# View full logs with filtering
adb logcat "ReelView:V" "*:S"

# Record screen (for debugging)
adb shell screenrecord /sdcard/recording.mp4

# Clear app cache
adb shell pm clear com.reelview.app
```

---

## NEXT STEPS

1. ? Run installation script
2. ? App launches on device
3. ? Test Chromecast casting
4. ? Check logs for any issues
5. ?? Report any problems

---

**All set! Use one of the three installation methods above.**

