# Build and Install Latest ReelView APK
# PowerShell version for Windows

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AndroidDir = Join-Path $ProjectRoot "android"
$ApkPath = Join-Path $ProjectRoot "android\app\build\outputs\apk\debug\app-debug.apk"

Write-Host "=== ReelView Build & Install Script ===" -ForegroundColor Green
Write-Host ""

# Step 1: Clean
Write-Host "[1/5] Cleaning previous build..." -ForegroundColor Cyan
cd $AndroidDir
./gradlew clean --no-daemon -q
if ($LASTEXITCODE -ne 0) { Write-Host "? Clean failed"; exit 1 }

# Step 2: Build
Write-Host "[2/5] Building APK (Debug)..." -ForegroundColor Cyan
./gradlew assembleDebug --no-daemon -x lint
if ($LASTEXITCODE -ne 0) { Write-Host "? Build failed"; exit 1 }

# Step 3: Check APK
Write-Host "[3/5] Checking APK..." -ForegroundColor Cyan
if (-not (Test-Path $ApkPath)) {
    Write-Host "? APK not found at $ApkPath" -ForegroundColor Red
    exit 1
}
$ApkSize = (Get-Item $ApkPath).Length / 1MB
Write-Host "? APK found: $($ApkSize.ToString('F2')) MB" -ForegroundColor Green

# Step 4: Install
Write-Host "[4/5] Installing APK..." -ForegroundColor Cyan
adb install -r $ApkPath
if ($LASTEXITCODE -ne 0) { Write-Host "? Install failed"; exit 1 }

# Step 5: Launch
Write-Host "[5/5] Launching app..." -ForegroundColor Cyan
adb shell am start -n "com.reelview.app/.MainActivity"

Write-Host ""
Write-Host "? Build and install complete!" -ForegroundColor Green
Write-Host "App should now be running on your device" -ForegroundColor Green
