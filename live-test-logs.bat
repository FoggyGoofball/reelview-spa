@echo off
setlocal

set "ADB=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo.
echo ========================================
echo ANDROID DOWNLOAD TESTING - LOG CAPTURE
echo ========================================
echo.
echo What to do on your phone:
echo 1. Play any video
echo 2. Scroll down and click Download button
echo 3. Click "Choose Quality"
echo 4. Watch logs below
echo.
echo Press Ctrl+C to stop logging
echo ========================================
echo.

"%ADB%" logcat -s HLSDownloaderPlugin:D ReelViewWebViewClient:D unified-download:D

endlocal
