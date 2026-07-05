# Extract logs from Reelview app on Android device
# Usage: .\get-reelview-logs.ps1

$AdbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "?? Retrieving logs from Reelview app..." -ForegroundColor Cyan
Write-Host ""

# Check if device is connected
$devices = & $AdbPath devices
if (-not ($devices -match "device$")) {
    Write-Host "? No Android device connected!" -ForegroundColor Red
    Write-Host "Please connect your device and try again."
    exit 1
}

Write-Host "? Device connected" -ForegroundColor Green
Write-Host ""

# Step 1: Create a shell script that will dump localStorage
Write-Host "Step 1: Setting up log extraction..." -ForegroundColor Yellow

# The localStorage is in the WebView's Local Storage directory
$webViewPath = "/data/data/com.reelview.app/app_webview/Local\ Storage/"

Write-Host "Step 2: Listing WebView localStorage..." -ForegroundColor Yellow
& $AdbPath shell "ls -la /data/data/com.reelview.app/app_webview/Local\ Storage/ 2>/dev/null" 2>$null | Write-Host

Write-Host ""
Write-Host "Step 3: Creating debug script..." -ForegroundColor Yellow

# Create a temporary JS file that will be executed in the browser context
$debugScript = @"
// This script should be pasted into the browser console when the app is running
// It will output the auto-exported logs

(function() {
  const logs = localStorage.getItem('REELVIEW_OVERLAY_LOGS');
  if (logs) {
    const parsed = JSON.parse(logs);
    console.log('=== REELVIEW DEBUG LOGS ===');
    console.log(JSON.stringify(parsed, null, 2));
    console.log('=== END LOGS ===');
    return parsed;
  } else {
    console.log('No logs found. Make sure the app is running and has encountered an ad overlay.');
    return null;
  }
})();
"@

Write-Host ""
Write-Host "?? MANUAL LOG RETRIEVAL" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Since WebView localStorage is sandboxed, follow these steps:" -ForegroundColor White
Write-Host ""
Write-Host "1. Make sure Reelview app is OPEN and running" -ForegroundColor Yellow
Write-Host "2. Play a video and trigger the ad overlay" -ForegroundColor Yellow
Write-Host "3. Wait 5-10 seconds for logs to auto-export" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then use ONE of these methods:" -ForegroundColor Cyan
Write-Host ""
Write-Host "METHOD A: Browser Console (if accessible)" -ForegroundColor Green
Write-Host "-------------------------------------------" -ForegroundColor Green
Write-Host "1. Open Chrome DevTools (if supported)" -ForegroundColor White
Write-Host "2. Go to Console tab" -ForegroundColor White
Write-Host "3. Paste this command:" -ForegroundColor White
Write-Host ""
Write-Host $debugScript -ForegroundColor Magenta
Write-Host ""
Write-Host "METHOD B: adb logcat (captures console.log output)" -ForegroundColor Green
Write-Host "---------------------------------------------------" -ForegroundColor Green
Write-Host "1. Run: & '$AdbPath' logcat | Select-String 'OVERLAY|AD_CAPTURE|AUTO-EXPORT'" -ForegroundColor White
Write-Host "2. Trigger the ad and check logcat output" -ForegroundColor White
Write-Host ""
Write-Host "METHOD C: Pull app data (requires root)" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Green
Write-Host "1. Run: & '$AdbPath' pull /data/data/com.reelview.app/app_webview/ ./app_webview_data/" -ForegroundColor White
Write-Host "2. Look for Local Storage leveldb files" -ForegroundColor White
Write-Host ""
Write-Host "=== WHAT TO LOOK FOR IN LOGS ===" -ForegroundColor Cyan
Write-Host "- '[OVERLAY-NEUTRALIZER]' entries showing detected overlays" -ForegroundColor White
Write-Host "- Scoring breakdown (isFullScreen, isHighZ, etc.)" -ForegroundColor White
Write-Host "- 'Neutralized overlay' messages with before/after styles" -ForegroundColor White
Write-Host "- '[AD_CAPTURE]' entries showing window.open interceptions" -ForegroundColor White
Write-Host ""

# Try to pull the app cache anyway
Write-Host ""
Write-Host "Step 4: Attempting to pull app cache (may fail without root)..." -ForegroundColor Yellow
& $AdbPath pull "/data/data/com.reelview.app/cache/" "./reelview_app_cache/" 2>$null | Write-Host

Write-Host ""
Write-Host "? Log retrieval setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "?? Next: Follow METHOD A, B, or C above to get the actual logs" -ForegroundColor Cyan
