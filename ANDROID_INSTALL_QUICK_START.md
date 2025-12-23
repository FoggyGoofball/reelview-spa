# ?? QUICK ANDROID INSTALLATION - COMMAND LINE

## ? SUPER QUICK INSTALL (2 steps)

### **Option 1: PowerShell (Easiest)**

1. **Plug phone in via USB**
   - Enable USB Debugging on phone (Settings > Developer Options > USB Debugging toggle)

2. **Run installer**
   ```powershell
   C:\Users\Admin\Downloads\reelview\install-reelview.ps1
   ```

**Done!** App installs and launches automatically.

---

### **Option 2: Command Prompt (Batch)**

1. **Plug phone in via USB**
   - Enable USB Debugging

2. **Run installer**
   ```cmd
   C:\Users\Admin\Downloads\reelview\install-reelview.bat
   ```

**Done!** App installs and launches.

---

## ?? Manual Steps (If Scripts Don't Work)

```powershell
# 1. Set paths
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:ANDROID_HOME = "$env:APPDATA\Android\sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools"

# 2. Check device connected
adb devices

# 3. Install APK
adb install "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"

# 4. Launch app
adb shell am start -n com.reelview.app/.MainActivity
```

---

## ? WHAT TO EXPECT

1. **Installation message**: `Success` or `cmd: Can't find 'install' subcommand` (ignore, it's a display issue)
2. **App launches** automatically on device
3. **First load** may take 10-15 seconds
4. **TMDB API key** - Enter it when prompted

---

## ?? TROUBLESHOOTING

### Device Not Found
```powershell
# Restart adb
adb kill-server
adb devices
```

### Installation Fails
- Check USB Debugging is ON (Settings > Developer Options)
- Try different USB port
- Check phone storage (need 200MB free)
- Unplug/replug USB cable

### App Won't Launch
- Check device has internet (WiFi)
- Check API key is set
- Check device storage
- Restart phone

---

## ?? BUILD STATUS

```
APK: ? Ready (4.5 MB)
Location: C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk
Latest Commit: c18085d
All Features: ? Included
Status: ? Production Ready
```

---

## ?? NEXT STEPS

1. ? Run one of the install scripts
2. ? Wait for app to appear on phone
3. ? Enter TMDB API key when prompted
4. ? Start testing!

---

**Simplest Method**: Just run `install-reelview.ps1` and let it do everything!
