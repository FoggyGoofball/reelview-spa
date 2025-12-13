#!/usr/bin/env pwsh
# PowerShell script to capture logcat from connected Android device

$ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$ADB = "$ANDROID_HOME\platform-tools\adb.exe"
$LOG_FILE = "C:\Users\Admin\Downloads\logcat_output.txt"

Write-Host "====================================" -ForegroundColor Green
Write-Host "LOGCAT CAPTURE SCRIPT (PowerShell)" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Check if ADB exists
if (!(Test-Path $ADB)) {
    Write-Host "ERROR: ADB not found at $ADB" -ForegroundColor Red
    exit 1
}

# Check if device is connected
$devices = & $ADB devices | Select-String -Pattern "[0-9A-F]{16,}.*device"
if ($null -eq $devices) {
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    Write-Host "Please connect your Android phone via USB"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Device connected!" -ForegroundColor Green
Write-Host ""
Write-Host "Clearing old logs..."
& $ADB logcat -c

Write-Host ""
Write-Host "INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host "1. Go to your phone" -ForegroundColor Cyan
Write-Host "2. Open ReelView app" -ForegroundColor Cyan
Write-Host "3. Go to any video page" -ForegroundColor Cyan
Write-Host "4. Click Download button" -ForegroundColor Cyan
Write-Host "5. Click 'Choose Quality'" -ForegroundColor Cyan
Write-Host "6. Wait 10 seconds" -ForegroundColor Cyan
Write-Host "7. Come back and press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting logcat capture..." -ForegroundColor Yellow
Write-Host "(Press Ctrl+C when done on phone)" -ForegroundColor Yellow
Write-Host ""

& $ADB logcat | Tee-Object -FilePath $LOG_FILE

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "Capture complete!" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Logs saved to: $LOG_FILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Filtering for relevant logs..." -ForegroundColor Yellow
Write-Host ""

Select-String -Path $LOG_FILE -Pattern "ReelViewWebViewClient|HLSDownloaderPlugin"

Write-Host ""
Write-Host "Done! Full output in: $LOG_FILE" -ForegroundColor Green
