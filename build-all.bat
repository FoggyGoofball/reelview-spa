@echo off
REM ReelView - Complete Build Automation Script
REM Builds Windows EXE and Android APK in one command
REM Usage: build-all.bat

setlocal enabledelayedexpansion

cls
echo.
echo ??????????????????????????????????????????????????????????????
echo ?         ReelView - Complete Build Automation              ?
echo ?              Windows EXE + Android APK                    ?
echo ??????????????????????????????????????????????????????????????
echo.

REM Check prerequisites
echo ??? CHECKING PREREQUISITES ???
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    exit /b 1
)
echo [OK] Node.js found

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found.
    exit /b 1
)
echo [OK] npm found

if not defined ANDROID_HOME (
    echo [WARNING] ANDROID_HOME not set. Android build will fail.
    echo [INFO] Set ANDROID_HOME to your Android SDK location to build APK.
)

REM Step 1: Build React SPA
echo.
echo ??? STEP 1: BUILD REACT SPA ???
cd spa
call npm run build
if errorlevel 1 (
    echo [ERROR] SPA build failed
    exit /b 1
)
echo [OK] React SPA built successfully
cd ..

REM Step 2: Deploy to Electron
echo.
echo ??? STEP 2: DEPLOY TO ELECTRON ???
echo Deploying SPA to Electron...
if exist fresh-migrated\electron\app (
    rmdir /s /q fresh-migrated\electron\app
)
mkdir fresh-migrated\electron\app
xcopy /e /i /y spa\dist fresh-migrated\electron\app
echo [OK] SPA deployed to Electron

REM Step 3: Synchronize Capacitor
echo.
echo ??? STEP 3: SYNCHRONIZE CAPACITOR ???
cd spa
call npm run cap:build
if errorlevel 1 (
    echo [ERROR] Capacitor sync failed
    exit /b 1
)
echo [OK] Capacitor synchronized
cd ..

REM Step 4: Build Windows EXE
echo.
echo ??? STEP 4: BUILD WINDOWS EXE ???
cd fresh-migrated\electron
echo Building Windows EXE...
call npm install
call npm run electron:make
if errorlevel 1 (
    echo [ERROR] Windows EXE build failed
    exit /b 1
)
echo [OK] Windows EXE built successfully
echo [INFO] Location: %cd%\out\make
cd ..\..

REM Step 5: Build Android APK
echo.
echo ??? STEP 5: BUILD ANDROID APK ???
cd spa
echo Building Android APK...
if not defined ANDROID_HOME (
    echo [ERROR] ANDROID_HOME not set. Skipping APK build.
    echo [INFO] Set ANDROID_HOME environment variable to build APK.
) else (
    call npm run cap:android -- --emulator --tasks build
    if errorlevel 1 (
        echo [WARNING] Android build may have failed. Check output above.
        echo [INFO] You may need to build manually using Android Studio.
    ) else (
        echo [OK] Android APK built successfully
        echo [INFO] Location: %cd%\android\app\build\outputs\apk
    )
)
cd ..

REM Summary
echo.
echo ??? BUILD SUMMARY ???
echo [OK] Build process completed!
echo.
echo Build Artifacts:
echo   Windows EXE:  fresh-migrated\electron\out\make
echo   Android APK: spa\android\app\build\outputs\apk
echo.
echo Ready for beta testing!
echo.

endlocal
