@echo off
REM Simple Uninstall and Reinstall Script
REM Uses basic adb commands

setlocal enabledelayedexpansion

set ADB=C:\Android\sdk\platform-tools\adb.exe
set APK=C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk
set PACKAGE=com.reelview.app

echo.
echo ===== UNINSTALL AND REINSTALL =====
echo.

REM Step 1: Check device
echo [1/3] Checking device...
"%ADB%" devices
echo.

REM Step 2: Uninstall
echo [2/3] Uninstalling %PACKAGE%...
"%ADB%" uninstall %PACKAGE%
echo.

REM Step 3: Reinstall
echo [3/3] Reinstalling APK...
"%ADB%" install -r "%APK%"
echo.

echo ===== DONE =====
echo App reinstalled on device.
pause
