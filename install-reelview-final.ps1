# ReelView APK Installation Script (PowerShell)
# Comprehensive installation with full error handling

param(
    [switch]$Force,
    [switch]$Uninstall
)

# Set up paths
$APK_PATH = "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"
$ADB_PATH = "C:\Android\sdk\platform-tools\adb.exe"
$PACKAGE_NAME = "com.reelview.app"
$ACTIVITY = "com.reelview.app.MainActivity"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   ReelView APK Installation (PowerShell)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Verify ADB exists
if (-not (Test-Path $ADB_PATH)) {
    Write-Host "ERROR: ADB not found at $ADB_PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Android SDK Platform Tools from:" -ForegroundColor Yellow
    Write-Host "https://developer.android.com/tools/releases/platform-tools" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Verify APK exists
if (-not (Test-Path $APK_PATH)) {
    Write-Host "ERROR: APK not found at $APK_PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "The APK needs to be built first:" -ForegroundColor Yellow
    Write-Host "  cd C:\Users\Admin\Downloads\reelview\android" -ForegroundColor Yellow
    Write-Host "  ./gradlew assembleDebug --no-daemon" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Function to run ADB command
function Invoke-ADB {
    param([string[]]$Arguments)
    & $ADB_PATH $Arguments
    return $LASTEXITCODE
}

# Step 1: Check device connection
Write-Host "[STEP 1/4] Checking device connection..." -ForegroundColor Green
Write-Host ""
Invoke-ADB -Arguments @("devices")
Write-Host ""

# Check if device is connected
$devices = (Invoke-ADB -Arguments @("devices") | Select-String -Pattern "device$" | Measure-Object).Count

if ($devices -eq 0) {
    Write-Host "No devices found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Connect your device and follow these steps:" -ForegroundColor Yellow
    Write-Host "  1. Connect via USB cable" -ForegroundColor Yellow
    Write-Host "  2. Go to Settings > Developer Options > USB Debugging" -ForegroundColor Yellow
    Write-Host "  3. Accept the USB debugging permission dialog" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Waiting for device..." -ForegroundColor Cyan
    
    # Wait for device
    $maxWait = 30
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $devices = (Invoke-ADB -Arguments @("devices") | Select-String -Pattern "device$" | Measure-Object).Count
        if ($devices -gt 0) {
            Write-Host "Device detected!" -ForegroundColor Green
            break
        }
        $waited++
        if ($waited % 5 -eq 0) {
            Write-Host "Still waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
        }
    }
    
    if ($devices -eq 0) {
        Write-Host "No device found after waiting. Please check connection and try again." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host "Device(s) found: $devices" -ForegroundColor Green
Write-Host ""

# Step 2: Optional uninstall
if ($Uninstall) {
    Write-Host "[STEP 2/4] Uninstalling old version..." -ForegroundColor Green
    Invoke-ADB -Arguments @("uninstall", $PACKAGE_NAME)
    Write-Host ""
}

# Step 3: Install APK
Write-Host "[STEP 3/4] Installing APK..." -ForegroundColor Green
Write-Host "APK: $(Get-Item $APK_PATH | Select-Object -ExpandProperty Length | ForEach-Object {[math]::Round($_/1MB, 2)}) MB" -ForegroundColor Gray
Write-Host ""

$installResult = Invoke-ADB -Arguments @("install", "-r", $APK_PATH)
$installCode = $LASTEXITCODE

if ($installCode -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Installation failed (exit code: $installCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions to try:" -ForegroundColor Yellow
    Write-Host "  1. Uninstall old version: adb uninstall $PACKAGE_NAME" -ForegroundColor Yellow
    Write-Host "  2. Restart USB debugging on device" -ForegroundColor Yellow
    Write-Host "  3. Clear app data: adb shell pm clear $PACKAGE_NAME" -ForegroundColor Yellow
    Write-Host "  4. Reconnect device via USB" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Installation successful!" -ForegroundColor Green
Write-Host ""

# Step 4: Launch app
Write-Host "[STEP 4/4] Launching app..." -ForegroundColor Green
Write-Host ""
Invoke-ADB -Arguments @("shell", "am", "start", "-n", "$PACKAGE_NAME/$ACTIVITY")

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "   SUCCESS!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The app is now installed and should be running." -ForegroundColor Green
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:        adb logcat -s ChromecastPlugin" -ForegroundColor Gray
Write-Host "  View all logs:    adb logcat | Select-String 'ReelView|CAST'" -ForegroundColor Gray
Write-Host "  Uninstall:        adb uninstall $PACKAGE_NAME" -ForegroundColor Gray
Write-Host "  Clear app data:   adb shell pm clear $PACKAGE_NAME" -ForegroundColor Gray
Write-Host "  Restart adb:      adb kill-server; adb start-server" -ForegroundColor Gray
Write-Host ""
Write-Host "Parameters:" -ForegroundColor Cyan
Write-Host "  -Uninstall       Remove old version before installing" -ForegroundColor Gray
Write-Host "  -Force           Skip confirmations" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
