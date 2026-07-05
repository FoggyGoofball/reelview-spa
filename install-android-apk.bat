@echo off
setlocal

echo Checking connected devices...
"C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe" devices

echo.
echo ========================================
echo Installing app-debug.apk to device...
echo ========================================
echo.

set "ADB=C:\Users\Admin\AppData\Local\Android\Sdk\platform-tools\adb.exe"
set "APK_PATH=C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk"

if not exist "%APK_PATH%" (
    echo ERROR: APK not found at %APK_PATH%
    exit /b 1
)

echo Uninstalling old version first...
"%ADB%" uninstall com.reelview.app

echo.
echo Installing from: %APK_PATH%
"%ADB%" install -r "%APK_PATH%"

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo INSTALLATION SUCCESSFUL!
    echo ========================================
    echo.
    echo Starting app...
    "%ADB%" shell am start -n com.reelview.app/.MainActivity
    echo.
    echo App is running with latest fixes!
) else (
    echo.
    echo INSTALLATION FAILED
    exit /b 1
)

endlocal
