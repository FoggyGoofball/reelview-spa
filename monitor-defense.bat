@echo off
REM Monitor native overlay defense activation
REM This script watches logcat for [DEFENSE] messages while you test on device

setlocal enabledelayedexpansion

set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

echo.
echo ========================================
echo  NATIVE OVERLAY DEFENSE - LIVE TESTING
echo ========================================
echo.
echo Instructions for your PHONE:
echo 1. Open the Reelview app
echo 2. Go to any movie or TV show
echo 3. Click the PLAY button
echo.
echo Watching logcat for [DEFENSE] messages...
echo (This will continue until you press Ctrl+C)
echo.

REM Clear previous logs
"%ADB%" logcat -c

REM Start monitoring - filter for DEFENSE, WebView, and errors
"%ADB%" logcat | findstr /R "DEFENSE|ReelViewWebView|INTERCEPTING|Neutralized|ERROR|BOUNDARY"

echo.
echo Monitoring stopped.
pause
