@echo off
setlocal

echo.
echo ========================================
echo Extracting TRUTH.apk to get correct SPA
echo ========================================
echo.

REM Create extraction folder
if exist "truth_apk_extracted" rmdir /s /q "truth_apk_extracted"
mkdir "truth_apk_extracted"

REM Extract APK (it's a ZIP file)
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('C:\Users\Admin\Downloads\TRUTH.apk', 'truth_apk_extracted')"

echo ? Extracted TRUTH.apk

REM Copy the correct SPA from TRUTH.apk
echo.
echo Copying correct SPA from TRUTH.apk to www...
echo.

REM The SPA is in assets/public in the APK
if exist "truth_apk_extracted\assets\public" (
    echo ? Found assets/public in TRUTH.apk
    
    REM Backup old www
    if exist "www_backup" rmdir /s /q "www_backup"
    if exist "www" move "www" "www_backup"
    
    REM Copy correct SPA
    move "truth_apk_extracted\assets\public" "www"
    
    echo ? Replaced www with correct SPA from TRUTH.apk
) else (
    echo ERROR: Could not find assets/public in TRUTH.apk
    echo Available contents:
    dir truth_apk_extracted
    exit /b 1
)

echo.
echo ========================================
echo SPA Extraction Complete!
echo ========================================
echo.
echo Next step: Run build-android-apk.bat to rebuild with correct SPA
echo.

endlocal
