@echo off
REM ReelView Electron Development - Quick Start Batch Script

if "%1%"=="" goto :help
if "%1%"=="build-spa" goto :build_spa
if "%1%"=="start-electron" goto :start_electron
if "%1%"=="full-dev" goto :full_dev
if "%1%"=="rebuild" goto :rebuild
if "%1%"=="clean" goto :clean
if "%1%"=="help" goto :help

:help
echo.
echo ??????????????????????????????????????????????????????????????????
echo ?         ReelView Electron Development Commands                ?
echo ??????????????????????????????????????????????????????????????????
echo.
echo Usage:
echo   dev.bat [command]
echo.
echo Commands:
echo   build-spa      Build the React SPA and copy to Electron
echo   start-electron Start Electron in dev mode
echo   full-dev       Build SPA, setup, and start Electron (all-in-one)
echo   rebuild        Clean and rebuild everything
echo   clean          Remove build artifacts
echo   help           Show this help message
echo.
echo Examples:
echo   dev.bat build-spa
echo   dev.bat start-electron
echo   dev.bat full-dev
echo.
echo For development workflow:
echo   1. dev.bat full-dev  (first time)
echo   2. Make changes to spa/src
echo   3. dev.bat build-spa
echo   4. Reload in Electron window (Ctrl+R or restart)
echo.
goto :end

:build_spa
echo.
echo Building SPA...
cd spa
call npm run build
if errorlevel 1 (
    echo Error building SPA
    goto :end
)
cd ..
echo.
echo Copying SPA dist to Electron...
xcopy spa\dist fresh-migrated\electron\app /E /I /Y >nul
echo SPA build complete!
goto :end

:start_electron
echo.
echo Starting Electron in dev mode...
cd fresh-migrated\electron
call npm run electron:start
cd ..
goto :end

:full_dev
echo.
echo ??????????????????????????????????????????????????????????????????
echo ?          Starting Complete Development Environment             ?
echo ??????????????????????????????????????????????????????????????????
echo.

echo Building SPA...
cd spa
call npm run build
if errorlevel 1 (
    echo Error building SPA
    cd ..
    goto :end
)
cd ..

echo.
echo Copying SPA dist to Electron...
xcopy spa\dist fresh-migrated\electron\app /E /I /Y >nul

echo.
echo Setting up Electron dependencies...
cd fresh-migrated\electron
call npm install
if errorlevel 1 (
    echo Error installing Electron dependencies
    cd ..\..
    goto :end
)

echo.
echo Building Electron TypeScript...
call npm run build
if errorlevel 1 (
    echo Error building Electron
    cd ..\..
    goto :end
)

echo.
echo Starting Electron...
call npm run electron:start
cd ..\..
goto :end

:rebuild
echo.
echo Cleaning build artifacts...
rmdir /s /q spa\dist 2>nul
rmdir /s /q fresh-migrated\electron\build 2>nul
rmdir /s /q fresh-migrated\electron\app 2>nul
echo Clean complete!
echo.
goto :full_dev

:clean
echo.
echo Cleaning build artifacts...
rmdir /s /q spa\dist 2>nul
rmdir /s /q fresh-migrated\electron\build 2>nul
rmdir /s /q fresh-migrated\electron\app 2>nul
echo Clean complete!
goto :end

:end
