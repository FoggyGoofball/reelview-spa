@echo off
setlocal enabledelayedexpansion

REM Set JAVA_HOME to JDK 25
set "JAVA_HOME=C:\Program Files\Java\jdk-25"
set "PATH=!JAVA_HOME!\bin;!PATH!"

REM Verify Java is available
echo Java version:
java -version

REM Go to android directory
cd /d "C:\Users\Admin\Downloads\reelview\android"

REM Build the APK
echo.
echo Building debug APK...
echo.
call gradlew.bat assembleDebug

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo APK location: app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Next: Connect phone and install with:
    echo adb install -r app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo BUILD FAILED - Check errors above
    exit /b 1
)

endlocal
