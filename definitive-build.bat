@echo off
setlocal

echo.
echo ========================================
echo DEFINITIVE BUILD: TRUTH SPA + ANDROID FIX
echo ========================================
echo.

REM Step 1: Extract TRUTH.apk
echo Step 1: Extracting TRUTH.apk SPA...
if exist "truth_final_extract" rmdir /s /q "truth_final_extract"
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\Admin\Downloads\TRUTH.apk', 'truth_final_extract')"

REM Step 2: Replace www
echo Step 2: Replacing www with TRUTH SPA...
if exist "www_backup_final" rmdir /s /q "www_backup_final"
if exist "www" move "www" "www_backup_final"
xcopy "truth_final_extract\assets\public" "www" /E /I /Y > nul
rmdir /s /q "truth_final_extract"

echo ? www folder replaced

REM Step 3: Capacitor sync to copy www to Android
echo.
echo Step 3: Syncing www to Android via Capacitor...
call npx cap sync android > nul 2>&1

echo ? Capacitor sync complete

REM Step 4: Verify android/app/src/main/assets/public has correct files
echo.
echo Step 4: Verifying Android assets...
if exist "android\app\src\main\assets\public\assets\index-D1VtdkH0.js" (
    echo ? Correct SPA bundle found in Android assets
) else (
    echo ? ERROR: SPA bundle not found!
    dir "android\app\src\main\assets\public\assets\"
    exit /b 1
)

REM Step 5: Build with Gradle
echo.
echo ========================================
echo Building APK...
echo ========================================

set "JAVA_HOME=C:\Program Files\Java\jdk-25"
set "PATH=!JAVA_HOME!\bin;!PATH!"

cd android
call gradlew.bat clean assembleDebug
set BUILD_RESULT=%errorlevel%
cd ..

if %BUILD_RESULT% equ 0 (
    echo.
    echo ========================================
    echo ? BUILD SUCCESSFUL!
    echo ========================================
    echo APK: android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Next: fresh-install.bat to install on phone
) else (
    echo.
    echo ? BUILD FAILED
    exit /b 1
)

endlocal
