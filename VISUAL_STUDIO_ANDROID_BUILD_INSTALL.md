# ?? ANDROID APK BUILD & INSTALL - VISUAL STUDIO METHOD

## ? STATUS: READY TO GO

You have TWO options with Visual Studio:

---

## **OPTION 1: Use Pre-Built APK (Fastest)**

The APK is already compiled and ready!

```
File: app-debug.apk
Location: C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\
Size: 4.5 MB
Status: ? READY TO INSTALL
```

### Install Steps:
1. **Connect Phone via USB**
   - Enable USB Debugging: Settings > Developer Options > USB Debugging toggle ON

2. **Open Command Prompt/PowerShell in Visual Studio**
   - Tools > Command Line > Developer PowerShell

3. **Run Install Command**
   ```powershell
   cd C:\Users\Admin\Downloads\reelview
   $env:PATH += ";$env:APPDATA\Android\sdk\platform-tools"
   adb devices
   adb install "android\app\build\outputs\apk\debug\app-debug.apk"
   ```

4. **Launch App**
   ```powershell
   adb shell am start -n com.reelview.app/.MainActivity
   ```

---

## **OPTION 2: Rebuild APK in Visual Studio Terminal**

If you want to rebuild the APK first:

### 1. **Open Reelview Project in Visual Studio**
- File > Open > Folder
- Select: `C:\Users\Admin\Downloads\reelview`

### 2. **Open Terminal**
- Terminal > New Terminal
- Or: **Ctrl + `** (backtick)

### 3. **Set Environment Variables**
```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:ANDROID_HOME = "$env:APPDATA\Android\sdk"
```

### 4. **Navigate to Android Project**
```powershell
cd android
```

### 5. **Build Debug APK**
```powershell
.\gradlew assembleDebug
```

Wait for build to complete. When done, you'll see:
```
BUILD SUCCESSFUL in 1m 18s
```

### 6. **Install APK**
```powershell
$env:PATH += ";$env:APPDATA\Android\sdk\platform-tools"
adb devices
adb install "app\build\outputs\apk\debug\app-debug.apk"
```

### 7. **Launch**
```powershell
adb shell am start -n com.reelview.app/.MainActivity
```

---

## ?? CHECKING ADB CONNECTION

Before installing, verify your phone is detected:

```powershell
# Check if adb is in PATH
adb devices

# You should see output like:
# List of attached devices
# emulator-5554          device
# or your actual phone
```

If `adb: command not found`, add it to PATH:
```powershell
$env:PATH += ";$env:APPDATA\Android\sdk\platform-tools"
adb devices
```

---

## ?? VISUAL STUDIO TIPS

### Opening Terminal in VS
1. **Terminal Menu** > New Terminal
2. Or press **Ctrl + `** (backtick key)
3. Or right-click folder in Explorer > Open in Terminal

### Useful VS Shortcuts
- **Ctrl + `** - Toggle terminal
- **Ctrl + Shift + `** - New terminal
- **Ctrl + J** - Toggle output window

### Run Multiple Commands
```powershell
# Set env vars
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:ANDROID_HOME = "$env:APPDATA\Android\sdk"
$env:PATH += ";$env:APPDATA\Android\sdk\platform-tools"

# Build
cd android
.\gradlew assembleDebug

# Install
adb install "app\build\outputs\apk\debug\app-debug.apk"

# Launch
adb shell am start -n com.reelview.app/.MainActivity
```

---

## ?? QUICK REFERENCE COMMANDS

```powershell
# View all connected devices
adb devices

# Check device info
adb shell getprop ro.build.version.release

# Install APK
adb install "path\to\app.apk"

# Launch app
adb shell am start -n com.reelview.app/.MainActivity

# View logs
adb logcat | grep ReelView

# Clear app cache
adb shell pm clear com.reelview.app

# View installed packages
adb shell pm list packages | grep reelview
```

---

## ? WHAT'S INSTALLED

Latest build with all features:
- ? Animation carousel filtering (no anime)
- ? Adult Animation (16+ only)  
- ? Watched episode green text
- ? Load More pagination
- ? Comprehensive rating system
- ? Watch history
- ? Continue watching
- ? All video sources

---

## ?? RECOMMENDED FLOW

**Simplest (Use Pre-Built):**
```
1. Connect phone
2. Enable USB Debugging
3. Open VS Terminal
4. Run adb install command
5. Done!
```

**With Rebuild:**
```
1. Open project folder in VS
2. Open terminal (Ctrl + `)
3. Set environment variables
4. Run: cd android
5. Run: .\gradlew assembleDebug
6. When done: adb install
7. Done!
```

---

## ?? TROUBLESHOOTING

### ADB Not Found
```powershell
# Add to PATH permanently
$env:PATH += ";$env:APPDATA\Android\sdk\platform-tools"
# Verify
adb --version
```

### Device Not Detected
- Check USB cable
- Enable USB Debugging on phone
- Try different USB port
- Restart adb: `adb kill-server` then `adb start-server`

### Build Fails
- Ensure Java is set: `java -version`
- Clear gradle cache: `del .gradle`
- Try: `.\gradlew clean assembleDebug`

### App Won't Launch
- Check TMDB API key is set in app
- Check phone has internet (WiFi)
- View logs: `adb logcat | grep ReelView`

---

## ?? BUILD SPECS

```
Java: 25.0.1 LTS ?
Gradle: 8.11.1 ?
Target: Android API 34 ?
Min: Android API 28 (Android 9.0) ?
Pre-built APK: Ready ?
```

---

**Ready to go! Choose Option 1 (fastest) or Option 2 (rebuild first) and follow the steps.**
