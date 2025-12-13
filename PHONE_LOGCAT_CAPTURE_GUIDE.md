# How to Capture Logcat From Your Phone - Quick Guide

## Step 1: Clear Old Logs (Optional but Recommended)
```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb logcat -c
```

## Step 2: Start Recording Logs
```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb logcat > C:\Users\Admin\Downloads\logcat_output.txt
```

This will start recording logs to a file. **Keep this terminal open.**

## Step 3: In Your Phone App - Trigger the Issue

While the logcat is recording:
1. Open the ReelView app on your phone
2. Navigate to any video page (Movies, TV Shows, Anime)
3. Click the **Download** button (? icon)
4. Click **"Choose Quality"**
5. Watch for 10 seconds

## Step 4: Stop Logcat Recording
Go back to the terminal and press: **Ctrl+C**

This will save all logs to `C:\Users\Admin\Downloads\logcat_output.txt`

## Step 5: Filter the Logs (Optional)
To see only the relevant logs:
```powershell
Get-Content C:\Users\Admin\Downloads\logcat_output.txt | Select-String "ReelViewWebViewClient|HLSDownloaderPlugin"
```

Or save filtered logs:
```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb logcat ReelViewWebViewClient:D HLSDownloaderPlugin:D *:I > C:\Users\Admin\Downloads\logcat_filtered.txt
```

## Quick Command (All-in-One)

Here's everything in one command:

```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"

# Clear old logs
Write-Host "Clearing old logs..."
& $adb logcat -c

# Start recording
Write-Host "Recording logcat (this will run until you press Ctrl+C)..."
Write-Host "NOW: Go to your phone and trigger the download issue"
Write-Host "Then come back and press Ctrl+C to stop recording"
Write-Host ""

& $adb logcat > C:\Users\Admin\Downloads\logcat_output.txt
```

## What to Look For in the Logs

Once you capture the logs, you're looking for these patterns:

**Good (Stream Captured):**
```
D/ReelViewWebViewClient: ? HLS stream MATCHED: https://...
D/HLSDownloaderPlugin: Captured stream (native): https://...
```

**Bad (Stream Not Found):**
```
D/ReelViewWebViewClient: ? Not HLS stream: https://...
D/HLSDownloaderPlugin: getCapturedStreams called - Current count: 0
```

## Files Generated

- **Full logs**: `C:\Users\Admin\Downloads\logcat_output.txt`
- **Filtered logs**: `C:\Users\Admin\Downloads\logcat_filtered.txt`

Share the logs with me and I'll identify the exact issue!

---

**TL;DR - Just Run This:**
```powershell
$env:ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb logcat -c
& $adb logcat > C:\Users\Admin\Downloads\logcat_output.txt
# Now go to phone, trigger download, come back and press Ctrl+C
```
