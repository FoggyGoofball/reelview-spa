# Monitor native overlay defense activation
# Watch logcat for [DEFENSE] messages while testing

$AdbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NATIVE OVERLAY DEFENSE - LIVE TESTING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instructions for your PHONE:" -ForegroundColor Yellow
Write-Host "1. Open the Reelview app"
Write-Host "2. Go to any movie or TV show"
Write-Host "3. Click the PLAY button"
Write-Host ""
Write-Host "Watching logcat for [DEFENSE] messages..." -ForegroundColor Green
Write-Host "(Press Ctrl+C to stop)"
Write-Host ""

# Clear previous logs
& $AdbPath logcat -c

# Start monitoring - filter for important messages
& $AdbPath logcat | Where-Object { $_ -match 'DEFENSE|ReelViewWebView|INTERCEPTING|Neutralized|ERROR|BOUNDARY' }

Write-Host ""
Write-Host "Monitoring stopped." -ForegroundColor Yellow
