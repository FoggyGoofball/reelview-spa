@echo off
REM Complete deployment script for ReelView Android with hardened modal

echo.
echo ============================================================
echo ReelView Android - Complete Deployment Script
echo ============================================================
echo.

REM Step 1: Fresh SPA build
echo [1/6] Building SPA fresh...
cd C:\Users\Admin\Downloads\reelview\spa
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: SPA build failed
    exit /b 1
)
echo ? SPA built

REM Step 2: Sync with Capacitor
echo.
echo [2/6] Syncing with Capacitor...
cd C:\Users\Admin\Downloads\reelview
call npx cap sync
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed
    exit /b 1
)
echo ? Capacitor synced

REM Step 3: Build Android APK
echo.
echo [3/6] Building Android APK (this takes 2-3 minutes)...
cd C:\Users\Admin\Downloads\reelview\android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
call gradlew clean assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: Android build failed
    exit /b 1
)
echo ? Android APK built

REM Step 4: Check if device is connected
echo.
echo [4/6] Checking device connection...
adb devices > nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: adb not found or device not connected
    echo Please connect device and run next steps manually:
    echo.
    echo   adb uninstall com.reelview.app
    echo   adb install android\app\build\outputs\apk\debug\app-debug.apk
    echo   adb shell pm clear com.reelview.app
    echo.
    pause
    exit /b 1
)

REM Step 5: Uninstall and install APK
echo.
echo [5/6] Installing APK on device...
adb uninstall com.reelview.app
adb install android\app\build\outputs\apk\debug\app-debug.apk
if %errorlevel% neq 0 (
    echo ERROR: APK installation failed
    exit /b 1
)
echo ? APK installed

REM Step 6: Clear app data
echo.
echo [6/6] Clearing app cache...
adb shell pm clear com.reelview.app
echo ? App cache cleared

echo.
echo ============================================================
echo ? DEPLOYMENT COMPLETE
echo ============================================================
echo.
echo Next: Open the app on your device and test:
echo  1. Click a video to play
echo  2. Click Download button
echo  3. Verify modal appears (NOT blank page)
echo  4. Select quality and try to download
echo.
echo Monitor logs with: adb logcat | grep -E "DOWNLOAD|AD_CAPTURE"
echo.
pause
