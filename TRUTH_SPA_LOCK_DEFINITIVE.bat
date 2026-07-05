@echo off
REM ========================================
REM TRUTH.APK SPA LOCK - NUCLEAR OPTION
REM ========================================
REM This script extracts the PRODUCTION SPA from TRUTH.apk
REM and LOCKS it in place so it can't be overwritten

setlocal enabledelayedexpansion

cd /d C:\Users\Admin\Downloads\reelview

echo [1/6] Removing broken spa directory...
if exist "spa_backup" rmdir /s /q "spa_backup"
if exist "spa" ren "spa" "spa_backup"

echo [2/6] Extracting TRUTH.apk...
if exist "..\truth_extract_lock" rmdir /s /q "..\truth_extract_lock"
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('%cd%\..\TRUTH.apk', '%cd%\..\truth_extract_lock')"

echo [3/6] Copying production SPA to spa/...
xcopy "..\truth_extract_lock\assets\public\*" "spa\" /E /I /Y >nul

echo [4/6] Verifying extraction...
dir "spa\assets\*.js"

echo [5/6] Copying to www/...
rmdir /s /q "www" 2>nul
xcopy "spa\*" "www\" /E /I /Y >nul

echo [6/6] Rebuilding APK with production SPA...
call npx cap sync android
cd android
call gradlew.bat clean assembleDebug
cd ..

echo.
echo ========================================
echo COMPLETE - Production SPA locked in place
echo ========================================
pause
