@echo off
REM ReelView Android Installation Script
REM This script installs the app-debug.apk to your connected Android device

echo.
echo ========================================
echo ReelView Android Installation
echo ========================================
echo.

REM Set environment variables
set JAVA_HOME=C:\Program Files\Java\jdk-25
set ANDROID_HOME=%APPDATA%\Android\sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools

echo [1/5] Checking for connected devices...
adb devices
echo.

echo [2/5] Waiting for device...
adb wait-for-device
echo Device found!
echo.

echo [3/5] Installing ReelView app...
adb install "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"
echo.

if %ERRORLEVEL% EQU 0 (
    echo [4/5] Installation successful!
    echo.
    echo [5/5] Launching app...
    adb shell am start -n com.reelview.app/.MainActivity
    echo.
    echo ========================================
    echo App launched successfully!
    echo ========================================
    echo.
    echo The app should now be running on your device.
    echo.
    pause
) else (
    echo [4/5] Installation failed!
    echo.
    echo Troubleshooting:
    echo - Ensure USB Debugging is enabled on device
    echo - Check device is properly connected
    echo - Try disconnecting and reconnecting USB cable
    echo - Restart adb: adb kill-server
    echo.
    pause
)
