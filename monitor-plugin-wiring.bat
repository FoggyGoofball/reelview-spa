@echo off
setlocal

set "ADB=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo Clearing logcat...
"%ADB%" logcat -c

echo.
echo Monitoring: MainActivity, ReelViewWebViewClient, HLSDownloaderPlugin
echo.

"%ADB%" logcat -s MainActivity:D ReelViewWebViewClient:D HLSDownloaderPlugin:D

endlocal
