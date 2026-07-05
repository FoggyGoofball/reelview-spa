@echo off
REM ========================================
REM  ReelView APK Installation Script
REM  Installs the latest built APK to device
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ======================================
echo   ReelView APK Installation
echo ======================================
echo.

REM Verify APK exists
set APK_PATH=C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk
if not exist "%APK_PATH%" (
    echo ERROR: APK not found at %APK_PATH%
    echo.
    echo Please build the APK first:
    echo   cd C:\Users\Admin\Downloads\reelview\android
    echo   ./gradlew assembleDebug --no-daemon
    echo.
    pause
    exit /b 1
)

echo [1/4] APK Found
for /F "usebackq" %%A in ('%APK_PATH%') do set APK_SIZE=%%~zA
set /a APK_SIZE_MB=APK_SIZE/1024/1024
echo   Path: %APK_PATH%
echo   Size: %APK_SIZE_MB% MB
echo.

echo [2/4] Checking device connection...
adb devices
echo.

echo [3/4] Installing APK (replacing old version)...
adb install -r "%APK_PATH%"
if errorlevel 1 (
    echo ERROR: Installation failed
    echo.
    echo Troubleshooting:
    echo   - Make sure device is connected via USB
    echo   - Enable USB debugging on device
    echo   - Run: adb devices (should show your device)
    echo.
    pause
    exit /b 1
)
echo.

echo [4/4] Launching app...
adb shell am start -n "com.reelview.app/.MainActivity"
echo.

echo ========================================
echo   SUCCESS!
echo ========================================
echo.
echo The app should now be running on your device.
echo.
echo To view logs:
echo   adb logcat -s "ChromecastPlugin"
echo.
echo Press any key to exit...
pause > nul
exit /b 0
