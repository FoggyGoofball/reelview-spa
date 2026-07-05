#!/usr/bin/env pwsh

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "ReelView Android - Complete Deployment Script" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""

# Step 1: Fresh SPA build
Write-Host "[1/6] Building SPA fresh..." -ForegroundColor Cyan
Set-Location C:\Users\Admin\Downloads\reelview\spa
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SPA build failed" -ForegroundColor Red
    exit 1
}
Write-Host "? SPA built" -ForegroundColor Green

# Step 2: Sync with Capacitor
Write-Host ""
Write-Host "[2/6] Syncing with Capacitor..." -ForegroundColor Cyan
Set-Location C:\Users\Admin\Downloads\reelview
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Capacitor sync failed" -ForegroundColor Red
    exit 1
}
Write-Host "? Capacitor synced" -ForegroundColor Green

# Step 3: Build Android APK
Write-Host ""
Write-Host "[3/6] Building Android APK (this takes 2-3 minutes)..." -ForegroundColor Cyan
Set-Location C:\Users\Admin\Downloads\reelview\android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
./gradlew clean assembleDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Android build failed" -ForegroundColor Red
    exit 1
}
Write-Host "? Android APK built" -ForegroundColor Green

# Step 4: Check if device is connected
Write-Host ""
Write-Host "[4/6] Checking device connection..." -ForegroundColor Cyan
$devices = adb devices 2>$null
if (-not $devices) {
    Write-Host "WARNING: adb not found or device not connected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please connect device and run manually:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  adb uninstall com.reelview.app" -ForegroundColor Gray
    Write-Host "  adb install android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Gray
    Write-Host "  adb shell pm clear com.reelview.app" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "? Device connected" -ForegroundColor Green

# Step 5: Uninstall and install APK
Write-Host ""
Write-Host "[5/6] Installing APK on device..." -ForegroundColor Cyan
adb uninstall com.reelview.app | Out-Null
adb install "android\app\build\outputs\apk\debug\app-debug.apk"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: APK installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "? APK installed" -ForegroundColor Green

# Step 6: Clear app data
Write-Host ""
Write-Host "[6/6] Clearing app cache..." -ForegroundColor Cyan
adb shell pm clear com.reelview.app
Write-Host "? App cache cleared" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "? DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next: Open the app on your device and test:" -ForegroundColor Yellow
Write-Host " 1. Click a video to play" -ForegroundColor Gray
Write-Host " 2. Click Download button" -ForegroundColor Gray
Write-Host " 3. Verify modal appears (NOT blank page)" -ForegroundColor Gray
Write-Host " 4. Select quality and try to download" -ForegroundColor Gray
Write-Host ""
Write-Host "Monitor logs with: adb logcat | grep -E 'DOWNLOAD|AD_CAPTURE'" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit"
