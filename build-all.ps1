# ReelView - Complete Build Automation Script
# Builds Windows EXE and Android APK in one command
# Usage: .\build-all.ps1

Write-Host "??????????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host "?         ReelView - Complete Build Automation              ?" -ForegroundColor Cyan
Write-Host "?              Windows EXE + Android APK                    ?" -ForegroundColor Cyan
Write-Host "??????????????????????????????????????????????????????????????" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

# Color functions
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Yellow }
function Write-Section { Write-Host $args -ForegroundColor Cyan }

# Check prerequisites
Write-Section "??? CHECKING PREREQUISITES ???"
try {
    $nodeVersion = node --version
    Write-Success "? Node.js: $nodeVersion"
    
    $npmVersion = npm --version
    Write-Success "? npm: $npmVersion"
    
    if (-not (Test-Path "C:\Program Files\Java")) {
        Write-Error-Custom "? Java not found. Required for Android build."
        exit 1
    }
    Write-Success "? Java SDK found"
    
    if (-not (Test-Path "$env:ANDROID_HOME")) {
        Write-Error-Custom "? ANDROID_HOME not set. Required for APK build."
        Write-Host "  Set ANDROID_HOME to your Android SDK location."
        exit 1
    }
    Write-Success "? ANDROID_HOME: $env:ANDROID_HOME"
    
} catch {
    Write-Error-Custom "? Prerequisite check failed: $_"
    exit 1
}

Write-Host ""
Write-Section "??? STEP 1: BUILD REACT SPA ???"
try {
    Push-Location spa
    Write-Host "Building React SPA in: $(Get-Location)"
    
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "SPA build failed" }
    
    Write-Success "? React SPA built successfully"
    Pop-Location
} catch {
    Write-Error-Custom "? SPA build failed: $_"
    exit 1
}

Write-Host ""
Write-Section "??? STEP 2: DEPLOY TO ELECTRON ???"
try {
    Write-Host "Deploying SPA to Electron..."
    
    $electronApp = "fresh-migrated\electron\app"
    if (Test-Path $electronApp) {
        Remove-Item -Path $electronApp -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    New-Item -ItemType Directory -Path $electronApp -Force | Out-Null
    Copy-Item -Path "spa\dist\*" -Destination $electronApp -Recurse -Force
    
    Write-Success "? SPA deployed to Electron"
} catch {
    Write-Error-Custom "? Electron deployment failed: $_"
    exit 1
}

Write-Host ""
Write-Section "??? STEP 3: SYNCHRONIZE CAPACITOR ???"
try {
    Push-Location spa
    Write-Host "Syncing Capacitor plugins..."
    
    npm run cap:build
    if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed" }
    
    Write-Success "? Capacitor synchronized"
    Pop-Location
} catch {
    Write-Error-Custom "? Capacitor sync failed: $_"
    exit 1
}

Write-Host ""
Write-Section "??? STEP 4: BUILD WINDOWS EXE ???"
try {
    Push-Location fresh-migrated\electron
    Write-Host "Building Windows EXE..."
    
    npm install
    npm run electron:make
    if ($LASTEXITCODE -ne 0) { throw "Electron build failed" }
    
    Write-Success "? Windows EXE built successfully"
    Write-Host "  Location: $(Get-Location)\out\make"
    Pop-Location
} catch {
    Write-Error-Custom "? Windows EXE build failed: $_"
    exit 1
}

Write-Host ""
Write-Section "??? STEP 5: BUILD ANDROID APK ???"
try {
    Push-Location spa
    Write-Host "Building Android APK..."
    
    # Generate APK
    npm run cap:android -- --emulator --tasks build
    if ($LASTEXITCODE -ne 0) { throw "Android build failed" }
    
    Write-Success "? Android APK built successfully"
    Write-Host "  Location: $(Get-Location)\android\app\build\outputs\apk"
    Pop-Location
} catch {
    Write-Error-Custom "? Android APK build failed: $_"
    Write-Host "  Note: Make sure Android Studio is installed and Android SDK is configured."
    Write-Host "  If building fails, you may need to build manually using Android Studio."
}

Write-Host ""
Write-Section "??? BUILD SUMMARY ???"
$EndTime = Get-Date
$Duration = $EndTime - $StartTime

Write-Success "? Build process completed!"
Write-Host ""
Write-Host "Build Artifacts:"
Write-Host "  Windows EXE:  fresh-migrated\electron\out\make"
Write-Host "  Android APK: spa\android\app\build\outputs\apk"
Write-Host ""
Write-Host "Total Time: $([math]::Round($Duration.TotalMinutes, 2)) minutes"
Write-Host ""
Write-Success "Ready for beta testing!"
