@echo off
REM Script to capture logcat from connected Android device
REM Usage: Just run this batch file while phone is connected

setlocal enabledelayedexpansion

set ANDROID_HOME=C:\Users\Admin\AppData\Local\Android\Sdk
set ADB=%ANDROID_HOME%\platform-tools\adb.exe
set LOG_FILE=C:\Users\Admin\Downloads\logcat_output.txt

echo ====================================
echo LOGCAT CAPTURE SCRIPT
echo ====================================
echo.

REM Check if device is connected
%ADB% devices | findstr /R "[0-9A-F].*device$" >nul
if errorlevel 1 (
    echo ERROR: No device connected!
    echo Please connect your Android phone via USB
    pause
    exit /b 1
)

echo Device connected!
echo.
echo Clearing old logs...
%ADB% logcat -c

echo.
echo INSTRUCTIONS:
echo 1. Go to your phone
echo 2. Open ReelView app
echo 3. Go to any video page
echo 4. Click Download button
echo 5. Click "Choose Quality"
echo 6. Wait 10 seconds
echo 7. Come back here and press any key
echo.
echo Capturing logcat...
echo Press Ctrl+C to stop manually, or press a key when done on phone

%ADB% logcat > %LOG_FILE%

echo.
echo ====================================
echo Capture complete!
echo Logs saved to: %LOG_FILE%
echo ====================================
echo.
echo Filtering for relevant logs...
echo.

findstr /I "ReelViewWebViewClient HLSDownloaderPlugin" %LOG_FILE%

echo.
echo Done! Check the file for full output:
echo %LOG_FILE%
pause
