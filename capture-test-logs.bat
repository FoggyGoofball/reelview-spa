@echo off
setlocal

set "ADB=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo.
echo ========================================
echo ANDROID DOWNLOAD TESTING - LOG CAPTURE
echo ========================================
echo.
echo Instructions:
echo 1. Open the ReelView app on your phone (it should already be open)
echo 2. Navigate to any Movie or TV Show
echo 3. Play the video
echo 4. Once video starts, scroll down and click the Download button
echo 5. Click "Choose Quality"
echo 6. Watch the logs below to see what happens
echo.
echo ========================================
echo Starting log capture (Press Ctrl+C to stop)
echo ========================================
echo.

REM Clear old logs
"%ADB%" logcat -c

REM Start capturing - show streams captured
"%ADB%" logcat -s HLSDownloaderPlugin:D ReelViewWebViewClient:D

endlocal
