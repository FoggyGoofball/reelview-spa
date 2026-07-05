@echo off
REM =====================================================
REM  ReelView APK Installation Script (Comprehensive)
REM  Handles ADB path, device detection, and installation
REM =====================================================

setlocal enabledelayedexpansion

REM Set up paths
set APK_PATH=C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk
set ADB_PATH=C:\Android\sdk\platform-tools\adb.exe
set ANDROID_HOME=C:\Android\sdk

REM Verify paths
if not exist "%ADB_PATH%" (
    echo ERROR: ADB not found at %ADB_PATH%
    echo.
    echo Please install Android SDK Platform Tools from:
    echo https://developer.android.com/tools/releases/platform-tools
    echo.
    pause
    exit /b 1
)

if not exist "%APK_PATH%" (
    echo ERROR: APK not found at %APK_PATH%
    echo.
    echo The APK needs to be built first:
    echo   cd C:\Users\Admin\Downloads\reelview\android
    echo   ./gradlew assembleDebug --no-daemon
    echo.
    pause
    exit /b 1
)

echo.
echo =====================================================
echo   ReelView APK Installation
echo =====================================================
echo.

REM Step 1: Check device connection
echo [STEP 1/4] Checking device connection...
echo.
"%ADB_PATH%" devices
echo.

REM Pause to let user see device status
echo If your device is not listed above:
echo   1. Connect device via USB cable
echo   2. Enable "USB Debugging" in Developer Options
echo   3. Accept USB debugging permission on device
echo.
echo Press any key to continue...
pause > nul

REM Step 2: Verify device is still connected
echo.
echo [STEP 2/4] Verifying device...
for /f "tokens=2" %%i in ('"%ADB_PATH%" devices ^| findstr /v "List"') do (
    set DEVICE_ID=%%i
)

if not defined DEVICE_ID (
    echo ERROR: No device found
    echo.
    echo Please check:
    echo   1. USB cable is connected
    echo   2. Device is unlocked
    echo   3. USB debugging is enabled
    echo.
    pause
    exit /b 1
)

echo Device found: %DEVICE_ID%
echo.

REM Step 3: Install APK
echo [STEP 3/4] Installing APK...
echo.
"%ADB_PATH%" install -r "%APK_PATH%"
if errorlevel 1 (
    echo.
    echo ERROR: Installation failed
    echo.
    echo Possible solutions:
    echo   1. Try again - sometimes needs retry
    echo   2. Uninstall old version: adb uninstall com.reelview.app
    echo   3. Restart device USB debugging
    echo.
    pause
    exit /b 1
)

echo.
echo Installation successful!
echo.

REM Step 4: Launch app
echo [STEP 4/4] Launching app...
echo.
"%ADB_PATH%" shell am start -n "com.reelview.app/.MainActivity"

echo.
echo =====================================================
echo   SUCCESS!
echo =====================================================
echo.
echo The app is now installed and launching on your device.
echo.
echo Useful commands:
echo   View logs:        adb logcat -s ChromecastPlugin
echo   Uninstall app:    adb uninstall com.reelview.app
echo   Clear app data:   adb shell pm clear com.reelview.app
echo.
pause
exit /b 0
