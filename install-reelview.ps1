# ReelView Android Installation Script (PowerShell)
# This script installs app-debug.apk to your connected Android device

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ReelView Android Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25"
$env:ANDROID_HOME = "$env:APPDATA\Android\sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools"

# Step 1: Check devices
Write-Host "[1/5] Checking for connected devices..." -ForegroundColor Yellow
adb devices
Write-Host ""

# Step 2: Wait for device
Write-Host "[2/5] Waiting for device..." -ForegroundColor Yellow
adb wait-for-device
Write-Host "? Device found!" -ForegroundColor Green
Write-Host ""

# Step 3: Install APK
Write-Host "[3/5] Installing ReelView app..." -ForegroundColor Yellow
adb install "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""

# Check if installation was successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "[4/5] Installation successful!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[5/5] Launching app..." -ForegroundColor Yellow
    adb shell am start -n com.reelview.app/.MainActivity
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "? App launched successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The app should now be running on your device." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[4/5] Installation failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "- Ensure USB Debugging is enabled on device" -ForegroundColor Gray
    Write-Host "- Check device is properly connected" -ForegroundColor Gray
    Write-Host "- Try disconnecting and reconnecting USB cable" -ForegroundColor Gray
    Write-Host "- Restart adb: adb kill-server" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
