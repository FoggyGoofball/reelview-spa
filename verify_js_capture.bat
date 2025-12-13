@echo off
REM Script to verify JavaScript stream capture is working
setlocal enabledelayedexpansion

set ANDROID_HOME=C:\Users\Admin\AppData\Local\Android\Sdk
set ADB=%ANDROID_HOME%\platform-tools\adb.exe

echo =============================================
echo VERIFICATION: JavaScript Stream Capture
echo =============================================
echo.
echo This will capture logs while you test the app.
echo.
echo Steps on your phone:
echo 1. Open the ReelView app
echo 2. Go to any video 
echo 3. Click Download button
echo 4. Click "Choose Quality"
echo 5. Come back and press Ctrl+C
echo.
echo Looking for:
echo  - [HLS-CAPTURE-JS] Stream capture interceptors installed
echo  - [HLS-CAPTURE-JS] Captured:
echo  - getCapturedStreams called - Current count: X
echo.
echo =============================================
echo.

%ADB% logcat -c

echo Capturing logs (Press Ctrl+C when done)...
echo.

%ADB% logcat ReelViewWebViewClient:D HLSDownloaderPlugin:D *:S 2>&1 | find /I "HLS-CAPTURE" 

echo.
echo =============================================
echo Done! Check above for [HLS-CAPTURE-JS] logs
echo =============================================
pause
