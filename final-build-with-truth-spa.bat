@echo off
setlocal

echo.
echo ========================================
echo FINAL: BUILDING APK WITH TRUTH SPA
echo ========================================
echo.

REM Step 1: Clean old files
echo Cleaning old build artifacts...
if exist "truth_check" rmdir /s /q "truth_check"
if exist "truth_apk_extracted" rmdir /s /q "truth_apk_extracted"

REM Step 2: Extract TRUTH.apk
echo Extracting TRUTH.apk...
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\Admin\Downloads\TRUTH.apk', 'truth_extract')"

REM Step 3: Replace www with exact copy from TRUTH.apk
echo Replacing www folder with TRUTH.apk version...
if exist "www" rmdir /s /q "www"
xcopy "truth_extract\assets\public" "www" /E /I /Y

REM Step 4: Verify www folder
echo.
echo Verifying www folder...
if exist "www\index.html" (
    echo ? www\index.html exists
    for %%I in ("www\index.html") do echo   Size: %%~zI bytes
) else (
    echo ? ERROR: www\index.html not found!
    exit /b 1
)

if exist "www\assets" (
    echo ? www\assets folder exists
) else (
    echo ? ERROR: www\assets folder not found!
    exit /b 1
)

REM Step 5: Clean up extraction folder
echo.
echo Cleaning up...
rmdir /s /q "truth_extract"

REM Step 6: Build APK
echo.
echo ========================================
echo Building APK with Gradle...
echo ========================================
echo.

set "JAVA_HOME=C:\Program Files\Java\jdk-25"
set "PATH=!JAVA_HOME!\bin;!PATH!"

cd android
call gradlew.bat assembleDebug
set BUILD_RESULT=%errorlevel%
cd ..

if %BUILD_RESULT% equ 0 (
    echo.
    echo ========================================
    echo ? BUILD SUCCESSFUL!
    echo ========================================
    echo APK: app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo ? BUILD FAILED
    exit /b 1
)

endlocal
