@echo off
setlocal

echo.
echo ========================================
echo PROPER ANDROID BUILD WITH CAP SYNC
echo ========================================
echo.

REM Step 1: Replace www with TRUTH.apk content
echo Step 1: Extracting TRUTH.apk SPA...
if exist "truth_extract" rmdir /s /q "truth_extract"
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\Admin\Downloads\TRUTH.apk', 'truth_extract')"

REM Step 2: Replace www with correct version
echo Step 2: Replacing www folder...
if exist "www_old" rmdir /s /q "www_old"
if exist "www" move "www" "www_old"
xcopy "truth_extract\assets\public" "www" /E /I /Y > nul
rmdir /s /q "truth_extract"
echo ? SPA replaced

REM Step 3: Run npm ci (install locked dependencies)
echo.
echo Step 3: Installing SPA dependencies...
cd spa
call npm ci
cd ..
echo ? Dependencies installed

REM Step 4: Build SPA
echo.
echo Step 4: Building SPA...
cd spa
call npm run build
cd ..
echo ? SPA built

REM Step 5: Capacitor sync (copies www to android assets)
echo.
echo Step 5: Syncing with Capacitor...
call npx cap sync android
echo ? Capacitor synced

REM Step 6: Build APK
echo.
echo ========================================
echo Step 6: Building APK...
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
) else (
    echo.
    echo ? BUILD FAILED
    exit /b 1
)

endlocal
