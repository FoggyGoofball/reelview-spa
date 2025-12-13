#!/usr/bin/env pwsh
# Complete diagnostic capture for ReelView Android download issue

$ANDROID_HOME = "C:\Users\Admin\AppData\Local\Android\Sdk"
$ADB = "$ANDROID_HOME\platform-tools\adb.exe"
$LOG_FILE = "$env:USERPROFILE\Downloads\logcat_diagnostic.txt"
$FILTERED_LOG = "$env:USERPROFILE\Downloads\logcat_filtered.txt"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "ReelView Android Download - Complete Diagnostic" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify device
Write-Host "Step 1: Verifying device connection..." -ForegroundColor Yellow
$devices = & $ADB devices | Select-String -Pattern "[0-9A-F]{16,}.*device"
if ($null -eq $devices) {
    Write-Host "ERROR: No device connected!" -ForegroundColor Red
    exit 1
}
Write-Host "? Device connected" -ForegroundColor Green
Write-Host ""

# Step 2: Clear cache
Write-Host "Step 2: Clearing app cache..." -ForegroundColor Yellow
& $ADB shell pm clear com.reelview.app 2>&1 > $null
Write-Host "? Cache cleared" -ForegroundColor Green
Write-Host ""

# Step 3: Clear logcat
Write-Host "Step 3: Clearing old logcat..." -ForegroundColor Yellow
& $ADB logcat -c
Write-Host "? Logcat cleared" -ForegroundColor Green
Write-Host ""

# Step 4: Instructions
Write-Host "Step 4: Ready to capture" -ForegroundColor Yellow
Write-Host ""
Write-Host "INSTRUCTIONS FOR YOUR PHONE:" -ForegroundColor Cyan
Write-Host "1. Open ReelView app (fresh start)" -ForegroundColor Cyan
Write-Host "2. Navigate to any video page" -ForegroundColor Cyan
Write-Host "3. Click Download button (? icon)" -ForegroundColor Cyan
Write-Host "4. Click 'Choose Quality'" -ForegroundColor Cyan
Write-Host "5. Wait 5 seconds" -ForegroundColor Cyan
Write-Host "6. Come back here and press Ctrl+C" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting logcat capture in 3 seconds..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 3

# Step 5: Capture
Write-Host "CAPTURING... (Press Ctrl+C when done)" -ForegroundColor Green
& $ADB logcat | Tee-Object -FilePath $LOG_FILE

# Step 6: Filter and display
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Capture complete - Processing logs" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Filtering for relevant logs..." -ForegroundColor Yellow
$filtered = @()
$filtered += "=== ReelViewWebViewClient Logs ==="
$filtered += (Select-String -Path $LOG_FILE -Pattern "ReelViewWebViewClient" | ForEach-Object { $_.Line })
$filtered += ""
$filtered += "=== HLSDownloaderPlugin Logs ==="
$filtered += (Select-String -Path $LOG_FILE -Pattern "HLSDownloaderPlugin" | ForEach-Object { $_.Line })

$filtered | Set-Content -Path $FILTERED_LOG
$filtered | Write-Host

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "Files saved:" -ForegroundColor Green
Write-Host "  Full log: $LOG_FILE" -ForegroundColor Cyan
Write-Host "  Filtered: $FILTERED_LOG" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# Analyze results
Write-Host "ANALYSIS:" -ForegroundColor Yellow
$hlsMatches = Select-String -Path $LOG_FILE -Pattern "? HLS stream MATCHED"
$noCaptured = Select-String -Path $LOG_FILE -Pattern "NO CAPTURED STREAMS"
$streamCaptured = Select-String -Path $LOG_FILE -Pattern "Captured stream.*native"

if ($hlsMatches.Count -gt 0) {
    Write-Host "? HLS streams were detected and matched" -ForegroundColor Green
}
else {
    Write-Host "? No HLS streams matched" -ForegroundColor Red
}

if ($streamCaptured.Count -gt 0) {
    Write-Host "? Streams were captured by plugin" -ForegroundColor Green
}
else {
    Write-Host "? No streams captured by plugin" -ForegroundColor Red
}

if ($noCaptured.Count -gt 0) {
    Write-Host "? Warning: No captured streams found when queried" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Next: Review the filtered log above to diagnose the issue" -ForegroundColor Cyan
