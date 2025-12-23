# ?? ANDROID STUDIO LAUNCH GUIDE - READY TO GO

## ? STATUS: SPA SYNCED & READY

```
SPA Build: ? Latest (30bf0f0)
www Folder: ? Updated with latest build
Android Project: ? Ready to build
APK Available: ? app-debug.apk (4.5 MB)
```

---

## ?? QUICK START

### 1. **Launch Android Studio**
```
C:\Program Files\Android\Android Studio\bin\studio64.exe
```

Or simply search for "Android Studio" in Windows and click it.

### 2. **Open Project**
- Click **File > Open**
- Navigate to: `C:\Users\Admin\Downloads\reelview`
- Click **Open**
- Wait for Gradle to sync (may take 1-2 minutes first time)

### 3. **Connect Your Android Device**
- Plug phone in via USB
- Enable USB Debugging:
  - Settings > About Phone (tap Build Number 7 times)
  - Settings > Developer Options > USB Debugging (toggle ON)
- Device should appear in Android Studio

### 4. **Run the App**
- Top menu: **Run > Run 'app'**
- Select your device from the popup
- Click **OK**
- Android Studio will:
  - Build the APK
  - Install on device
  - Launch the app automatically

**That's it! The app should launch on your phone.**

---

## ?? If Gradle Sync Takes Long

First sync can take 2-5 minutes. If it seems stuck:
- **Wait** - Gradle downloads dependencies
- Check bottom status bar for progress
- Be patient, especially if this is first time opening

---

## ? WHAT'S INSTALLED

Latest build includes:
- ? Animation carousel filtering (no anime)
- ? Adult Animation (16+ only)
- ? Watched episode indicators (green text)
- ? Load More pagination
- ? Comprehensive rating system
- ? Watch history tracking
- ? Continue watching
- ? All video sources

---

## ?? BUILD CONFIGURATION

```
Java: 25.0.1 LTS
Gradle: 8.11.1
Target Android: API 34
Min Android: API 28 (Android 9.0)
Build Type: Debug (all features enabled)
```

---

## ?? DEVICE REQUIREMENTS

**Minimum:**
- Android 9.0 (API 28)
- 512 MB RAM
- USB cable (for ADB/installation)

**Recommended:**
- Android 12+ (API 31+)
- 2+ GB RAM
- WiFi connection

---

## ?? COMMON ISSUES

### "Device not found"
- Ensure USB Debugging is ON
- Try different USB cable
- Unplug and replug
- Restart Android Studio

### "Gradle build failed"
- Close Android Studio
- Delete: `C:\Users\Admin\Downloads\reelview\.gradle`
- Reopen Android Studio
- Let it sync fresh

### "Build successful but app won't launch"
- Check device storage (need ~200 MB free)
- Check device is actually connected
- Watch logcat for crash messages

### "App is blank/black"
- Check your API key is set in the app
- Check internet connection
- Try Force Stop and Clear Cache in device settings

---

## ?? PROJECT STRUCTURE

```
C:\Users\Admin\Downloads\reelview\
??? android/              ? Android Gradle project
??? spa/                  ? React SPA source
??? www/                  ? Capacitor web assets (auto-synced)
??? capacitor.config.ts   ? Capacitor config
??? package.json          ? Dependencies
```

---

## ? VERIFICATION CHECKLIST

Before opening Android Studio:

- [x] SPA built and synced to www/ folder
- [x] Latest commit synced: 30bf0f0
- [x] Android Studio installed: `C:\Program Files\Android\Android Studio`
- [x] Java 25 available
- [x] APK pre-built: `android/app/build/outputs/apk/debug/app-debug.apk`
- [x] No uncommitted changes in Git
- [x] www/ folder populated with latest build

---

## ?? YOU'RE ALL SET!

Just open Android Studio and click **Run > Run 'app'** with your phone connected!

Android Studio will handle:
- Building the APK
- Installing on device
- Launching the app
- Showing logcat (debug output)

---

**Next Step:** Launch Android Studio and select File > Open for the reelview directory.
