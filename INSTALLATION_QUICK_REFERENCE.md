# INSTALLATION REFERENCE CARD

## QUICK INSTALL (Choose One Method)

### METHOD 1: Batch Script (EASIEST)
```
1. Double-click: install-reelview-final.bat
2. Follow prompts
3. App launches on device
```

### METHOD 2: PowerShell
```powershell
.\install-reelview-final.ps1
```

### METHOD 3: Manual
```powershell
$adb = "C:\Android\sdk\platform-tools\adb.exe"
& $adb install -r "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"
& $adb shell am start -n "com.reelview.app/.MainActivity"
```

---

## DEVICE SETUP (First Time)

1. Connect device via USB
2. Settings ? Developer Options ? USB Debugging (ON)
3. Accept USB debugging permission dialog
4. Run installation script

---

## APK INFO

| Property | Value |
|----------|-------|
| **File** | app-debug.apk |
| **Path** | `C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\` |
| **Size** | 15.17 MB |
| **Built** | 2026-01-12 10:49:35 |
| **Status** | ? Ready |

---

## CHROMECAST RECEIVER URL

```
https://foggygoofball.github.io/reelview-final/chromecast-receiver.html
```

---

## USEFUL COMMANDS

```powershell
# Device management
adb devices                                    # List devices
adb kill-server                               # Restart ADB
adb reboot                                    # Reboot device

# App management
adb install -r "<apk-path>"                  # Install APK
adb uninstall com.reelview.app                # Uninstall app
adb shell pm clear com.reelview.app           # Clear app data
adb shell pm list packages | Select-String reelview  # Find app

# Logging
adb logcat -s ChromecastPlugin                # Chromecast logs
adb logcat | Select-String "ReelView|CAST"    # All ReelView logs
adb logcat -c                                 # Clear logs

# Info
adb shell getprop ro.build.version.release    # Android version
adb shell getprop ro.product.model            # Device model
adb shell dumpsys package com.reelview.app    # App details
```

---

## TROUBLESHOOTING QUICK FIX

| Problem | Solution |
|---------|----------|
| Device not found | `adb kill-server; adb start-server; adb devices` |
| Installation fails | `adb uninstall com.reelview.app` then retry |
| App crashes | `adb logcat -s ReelView` (check logs) |
| Permission denied | Reconnect USB, accept dialog on device |
| Storage full | `adb shell pm clear com.reelview.app` |

---

## WHAT TO TEST AFTER INSTALL

- [ ] App launches
- [ ] Can play video
- [ ] Cast button appears
- [ ] Cast to Chromecast works
- [ ] Video plays on TV
- [ ] Audio works

---

## LOGS TO CHECK

```powershell
# After installation
adb logcat -s ChromecastPlugin | head -30

# After casting
adb logcat | Select-String "CAST\|Receiver\|GitHub"

# Full app logs
adb logcat -s ReelView
```

---

## BUILD SUMMARY

? SPA built successfully  
? Synced to Capacitor  
? APK compiled without errors  
? GitHub Pages receiver configured  
? Installation scripts created  
? Ready for device installation  

---

**Choose a method above and install the app. It's ready to go!**
