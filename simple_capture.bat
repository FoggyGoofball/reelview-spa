@echo off
REM Simple logcat capture script
setlocal enabledelayedexpansion

set ANDROID_HOME=C:\Users\Admin\AppData\Local\Android\Sdk
set ADB=%ANDROID_HOME%\platform-tools\adb.exe
set LOG_FILE=%USERPROFILE%\Downloads\logcat_debug.txt

echo.
echo =====================================
echo LOGCAT CAPTURE - ReelView Download Debug
echo =====================================
echo.
echo Clearing old logs...
%ADB% logcat -c

echo Waiting for app to be ready...
timeout /t 2 /nobreak

echo.
echo RECORDING LOGCAT
echo =====================================
echo.
echo GO TO YOUR PHONE NOW:
echo 1. Open ReelView app
echo 2. Go to any video
echo 3. Click Download button
echo 4. Click "Choose Quality"
echo 5. Wait 10 seconds
echo 6. Come back and press Ctrl+C to stop
echo.
echo Capturing logs...
echo.

%ADB% logcat > %LOG_FILE%

echo.
echo =====================================
echo Capture stopped
echo =====================================
echo.
echo Logs saved to: %LOG_FILE%
echo.
echo Looking for ReelViewWebViewClient and HLSDownloaderPlugin logs...
echo.

findstr /I "ReelViewWebViewClient HLSDownloaderPlugin" %LOG_FILE%

echo.
echo Full log file: %LOG_FILE%
echo.
pause
