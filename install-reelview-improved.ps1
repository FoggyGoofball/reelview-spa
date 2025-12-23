# ReelView Android Installation - Improved Script
# This script finds ADB and installs the APK

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ReelView Android Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to find ADB
function Find-ADB {
    # Check common locations
    $possiblePaths = @(
        "C:\Program Files\Android\Android Studio\platform-tools\adb.exe",
        "C:\Program Files\Android\android-sdk\platform-tools\adb.exe",
        "C:\Android\sdk\platform-tools\adb.exe",
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe",
        "C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            Write-Host "? Found ADB at: $path" -ForegroundColor Green
            return $path
        }
    }
    
    # Try to find it in PATH
    try {
        $adbPath = (Get-Command adb -ErrorAction Stop).Source
        Write-Host "? Found ADB in PATH: $adbPath" -ForegroundColor Green
        return $adbPath
    } catch {
        return $null
    }
}

# Find ADB
Write-Host "[1/5] Locating ADB..." -ForegroundColor Yellow
$adbPath = Find-ADB

if (-not $adbPath) {
    Write-Host "? ADB not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host "1. Open Android Studio" -ForegroundColor Gray
    Write-Host "2. Go to Tools > SDK Manager" -ForegroundColor Gray
    Write-Host "3. Ensure 'Android SDK Platform-Tools' is installed" -ForegroundColor Gray
    Write-Host "4. Run this script again" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check devices
Write-Host "[2/5] Checking for connected devices..." -ForegroundColor Yellow
& $adbPath devices
Write-Host ""

# Install APK
Write-Host "[3/5] Installing ReelView app..." -ForegroundColor Yellow
$apkPath = "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"

if (-not (Test-Path $apkPath)) {
    Write-Host "? APK not found at: $apkPath" -ForegroundColor Red
    exit 1
}

& $adbPath install $apkPath
Write-Host ""

# Check if successful
if ($LASTEXITCODE -eq 0) {
    Write-Host "[4/5] Installation successful!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "[5/5] Launching app..." -ForegroundColor Yellow
    & $adbPath shell am start -n com.reelview.app/.MainActivity
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "? App launched successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The app should now be running on your device." -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[4/5] Installation issue detected" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "- Ensure USB Debugging is enabled: Settings > Developer Options > USB Debugging" -ForegroundColor Gray
    Write-Host "- Check device is properly connected with USB cable" -ForegroundColor Gray
    Write-Host "- Try: Disconnect USB, reconnect after 5 seconds" -ForegroundColor Gray
    Write-Host "- Verify device storage has 200+ MB free" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
