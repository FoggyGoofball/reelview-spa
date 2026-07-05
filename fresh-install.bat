@echo off
setlocal

set "ADB=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"

echo Uninstalling old version...
"%ADB%" uninstall com.reelview.app

echo Waiting for uninstall to complete...
timeout /t 3 /nobreak

echo Installing fresh build...
"%ADB%" install -r "C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"

echo Starting app...
timeout /t 2 /nobreak
"%ADB%" shell am start -n com.reelview.app/.MainActivity

echo.
echo ========================================
echo Fresh install complete!
echo ========================================

endlocal
