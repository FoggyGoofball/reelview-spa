# ReelView APK Installation Script (PowerShell)

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   ReelView APK Installation" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Verify APK exists
$APK_PATH = "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $APK_PATH)) {
    Write-Host "ERROR: APK not found at $APK_PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please build the APK first:" -ForegroundColor Yellow
    Write-Host "  cd C:\Users\Admin\Downloads\reelview\android" -ForegroundColor Yellow
    Write-Host "  ./gradlew assembleDebug --no-daemon" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 1: Verify APK
Write-Host "[1/4] APK Found" -ForegroundColor Green
$APK_SIZE_MB = [math]::Round((Get-Item $APK_PATH).Length / 1MB, 2)
Write-Host "  Path: $APK_PATH"
Write-Host "  Size: $APK_SIZE_MB MB"
Write-Host "  Built: $(Get-Item $APK_PATH | Select-Object -ExpandProperty LastWriteTime)"
Write-Host ""

# Step 2: Check devices
Write-Host "[2/4] Checking device connection..." -ForegroundColor Green
adb devices
Write-Host ""

# Step 3: Install APK
Write-Host "[3/4] Installing APK (replacing old version)..." -ForegroundColor Green
adb install -r $APK_PATH
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  - Make sure device is connected via USB" -ForegroundColor Yellow
    Write-Host "  - Enable USB debugging on device (Developer Options)" -ForegroundColor Yellow
    Write-Host "  - Run: adb devices (should show your device)" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 4: Launch app
Write-Host "[4/4] Launching app..." -ForegroundColor Green
adb shell am start -n "com.reelview.app/.MainActivity"
Write-Host ""

Write-Host "======================================" -ForegroundColor Green
Write-Host "   SUCCESS!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "The app should now be running on your device." -ForegroundColor Green
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Cyan
Write-Host "  adb logcat -s ""ChromecastPlugin""" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view all ReelView logs:" -ForegroundColor Cyan
Write-Host "  adb logcat | Select-String ""ReelView|CAST|Download""" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
