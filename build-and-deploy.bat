@echo off
cd /d C:\Users\Admin\Downloads\reelview\spa
echo Building SPA...
call npm run build
echo.
echo Copying to Android assets...
rmdir /s /q C:\Users\Admin\Downloads\reelview\android\app\src\main\assets\public
xcopy /E /I dist C:\Users\Admin\Downloads\reelview\android\app\src\main\assets\public
echo.
echo Building Android APK...
cd /d C:\Users\Admin\Downloads\reelview\android
call gradlew.bat clean assembleDebug
echo.
echo Installing APK...
for /f %%A in ('where adb.exe') do set "ADB_PATH=%%A"
if "%ADB_PATH%"=="" set "ADB_PATH=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
echo ADB Path: %ADB_PATH%
%ADB_PATH% uninstall com.reelview.app
timeout /t 2
%ADB_PATH% install app\build\outputs\apk\debug\app-debug.apk
echo.
echo Done!
pause
