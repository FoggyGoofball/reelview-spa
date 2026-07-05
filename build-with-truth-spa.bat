@echo off
setlocal

echo.
echo ========================================
echo BUILDING APK WITH CORRECT TRUTH SPA
echo ========================================
echo.

REM Step 1: Extract correct SPA from TRUTH.apk
echo Step 1: Extracting correct SPA from TRUTH.apk...
echo.

if exist "truth_apk_extracted" rmdir /s /q "truth_apk_extracted"
mkdir "truth_apk_extracted"

powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\Admin\Downloads\TRUTH.apk', 'truth_apk_extracted')"

echo ? Extracted TRUTH.apk

REM Step 2: Backup and replace www
echo.
echo Step 2: Replacing www with correct SPA...
echo.

if exist "www_old" rmdir /s /q "www_old"
if exist "www" move "www" "www_old"
move "truth_apk_extracted\assets\public" "www"

echo ? SPA replaced in www folder

REM Step 3: Set JAVA_HOME and build
echo.
echo Step 3: Building APK with Gradle...
echo.

set "JAVA_HOME=C:\Program Files\Java\jdk-25"
set "PATH=!JAVA_HOME!\bin;!PATH!"

cd android

echo Building debug APK...
call gradlew.bat assembleDebug

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo ? BUILD SUCCESSFUL!
    echo ========================================
    echo APK: app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo BUILD FAILED
    exit /b 1
)

cd ..

endlocal
