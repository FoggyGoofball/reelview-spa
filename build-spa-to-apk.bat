@echo off
setlocal enabledelayedexpansion

REM Colors (using findstr for visual feedback)
echo.
echo ============================================================
echo  REELVIEW BUILD - SPA to APK (Complete Cache-Proof Pipeline)
echo ============================================================
echo.

REM Step 1: Build SPA
echo [1/7] Building SPA with Vite...
cd spa
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: SPA build failed
    exit /b 1
)
echo OK: SPA build complete
cd ..

REM Extract new hash
for /f "delims=" %%A in ('dir /b spa\dist\assets\index-*.js 2^>nul') do (
    set FILENAME=%%A
)
if "!FILENAME!"=="" (
    echo ERROR: No index-*.js file found in spa/dist/assets/
    exit /b 1
)

for /f "tokens=2 delims=-" %%A in ("!FILENAME!") do (
    set NEW_HASH=%%A
    set NEW_HASH=!NEW_HASH:.js=!
)

echo.
echo [2/7] Asset Hash: !NEW_HASH!
echo.

REM Step 2: Backup old assets
echo [3/7] Backing up old Android assets...
set ANDROID_ASSETS=android\app\src\main\assets\public\assets
if exist "%ANDROID_ASSETS%" (
    for /f "skip=1 tokens=3-7" %%A in ('dir "%ANDROID_ASSETS%" ^| findstr "index-"') do (
        set OLD_HASH=%%A
        set OLD_HASH=!OLD_HASH:index-=!
        set OLD_HASH=!OLD_HASH:.js=!
    )
    if "!OLD_HASH!"=="" (
        echo (No old assets to backup)
    ) else (
        echo Old hash: !OLD_HASH!
    )
)

REM Step 3: Clean old assets
echo [4/7] Removing old Android assets...
if exist "%ANDROID_ASSETS%" (
    rmdir /s /q "%ANDROID_ASSETS%"
    if %errorlevel% equ 0 (
        echo OK: Old assets deleted
    ) else (
        echo ERROR: Failed to delete old assets
        exit /b 1
    )
)
mkdir "%ANDROID_ASSETS%"
echo OK: Asset directory ready

REM Step 4: Sync new assets
echo [5/7] Syncing new SPA assets to Android...
xcopy /E /I /Y /Q "spa\dist\assets\*" "%ANDROID_ASSETS%\"
if %errorlevel% neq 0 (
    echo ERROR: Failed to sync assets
    exit /b 1
)
copy /Y "spa\dist\index.html" "%ANDROID_ASSETS%\index.html" >nul 2>&1
echo OK: Assets synced

REM Step 5: Clean Gradle
echo [6/7] Cleaning Gradle cache...
cd android

REM Delete build folder if exists
if exist "app\build" (
    rmdir /s /q "app\build"
)

REM Run gradle clean
call .\gradlew.bat clean
if %errorlevel% neq 0 (
    echo ERROR: Gradle clean failed
    cd ..
    exit /b 1
)
echo OK: Gradle cache cleaned

REM Step 6: Build APK
echo [7/7] Building APK with assembleDebug...
call .\gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: APK build failed
    cd ..
    exit /b 1
)

cd ..

echo.
echo ============================================================
echo  BUILD COMPLETE - VERIFYING RESULTS
echo ============================================================
echo.

REM Verify APK exists
set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk
if not exist "%APK_PATH%" (
    echo ERROR: APK file not found at %APK_PATH%
    exit /b 1
)

echo OK: APK file exists
echo Path: %APK_PATH%
echo.

REM Check APK contents
echo Verifying APK contains correct assets...
PowerShell -Command "$zip = [System.IO.Compression.ZipFile]::OpenRead('%APK_PATH%'); $entries = $zip.Entries | Where-Object { $_.FullName -like 'assets/public/assets/index-*.js' }; if ($entries) { Write-Host ('OK: Found ' + $entries.Count + ' index files'); $entries | ForEach-Object { Write-Host ('  - ' + $_.Name) } } else { Write-Host 'ERROR: No index files found in APK'; Exit 1 }"

if %errorlevel% neq 0 (
    echo ERROR: APK verification failed
    exit /b 1
)

echo.
echo ============================================================
echo  SUCCESS!
echo ============================================================
echo New Asset Hash: !NEW_HASH!
echo APK Ready: %APK_PATH%
echo.
echo Next steps:
echo   1. adb uninstall com.reelview.app
echo   2. adb install %APK_PATH%
echo   3. Check logcat: adb logcat ^| grep "index-"
echo.
