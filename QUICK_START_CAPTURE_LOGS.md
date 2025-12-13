# ? QUICK START - Capture Logs From Your Phone NOW

## ? What We Already Did
- Built app-debug.apk with detailed logging
- Installed it on your phone via ADB
- Created automated scripts to capture logs

## ?? What You Do Now (3 Steps)

### Step 1: Run the Capture Script

**Choose ONE:**

#### Option A: Batch File (Easiest)
```
Double-click: capture_logcat.bat
```

#### Option B: PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File capture_logcat.ps1
```

#### Option C: Manual Command
```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb logcat > C:\Users\Admin\Downloads\logcat_output.txt
```

### Step 2: Trigger the Issue on Your Phone

While the script is running:
```
1. Open ReelView app on phone
2. Click any category (Movies, TV, Anime)
3. Click any video title
4. Click Download button (? icon)
5. Click "Choose Quality"
6. Wait 10 seconds
```

### Step 3: Stop Capture & Get Logs

**If using script:**
- Press `Ctrl+C` in the terminal

**Log file will be at:**
```
C:\Users\Admin\Downloads\logcat_output.txt
```

## ?? What We're Looking For

After capture, you'll see logs like:

**? GOOD (Stream Captured):**
```
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://stream...
D/HLSDownloaderPlugin: Captured stream (native): https://stream...
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 1
```

**? BAD (Stream Not Found):**
```
D/ReelViewWebViewClient: ? Not HLS stream: https://...
D/ReelViewWebViewClient: ? Not HLS stream: https://...
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 0
D/HLSDownloaderPlugin: ? NO CAPTURED STREAMS
```

## ?? Next Action

1. Run the capture script
2. Share the output with me
3. I'll fix the issue based on the logs

---

**Device Status:** ? Connected (49231FDJH0028H)  
**App Status:** ? Installed (app-debug.apk)  
**Ready to capture:** ? YES

**Just run the script and follow the phone instructions!**
