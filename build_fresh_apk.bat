@echo off
cd C:\Users\Admin\Downloads\reelview\android
set JAVA_HOME=C:\Program Files\Java\jdk-21
call gradlew.bat clean assembleDebug
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ====== BUILD SUCCESSFUL ======
    echo APK location: C:\Users\Admin\Downloads\reelview\android\app\build\outputs\apk\debug\app-debug.apk
    pause
) else (
    echo.
    echo ====== BUILD FAILED ======
    pause
)
