#!/usr/bin/env pwsh
# Development workflow for ReelView Electron + SPA

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('build-spa', 'start-electron', 'full-dev', 'rebuild', 'clean', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'

function Show-Help {
    Write-Host @"
??????????????????????????????????????????????????????????????????
?         ReelView Electron Development Commands                ?
??????????????????????????????????????????????????????????????????

Usage:
  ./dev.ps1 [command]

Commands:
  build-spa      Build the React SPA and copy to Electron
  start-electron Start Electron in dev mode
  full-dev       Build SPA, setup, and start Electron (all-in-one)
  rebuild        Clean and rebuild everything
  clean          Remove build artifacts
  help           Show this help message

Examples:
  ./dev.ps1 build-spa
  ./dev.ps1 start-electron
  ./dev.ps1 full-dev

For development workflow:
  1. ./dev.ps1 full-dev  (first time)
  2. Make changes to spa/src
  3. ./dev.ps1 build-spa
  4. Reload in Electron window (Ctrl+R or restart)
"@
}

function Build-SPA {
    Write-Host "?? Building SPA..." -ForegroundColor Cyan
    Push-Location spa
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "SPA build failed"
        }
        Write-Host "? SPA built successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Copy-ToElectron {
    Write-Host "?? Copying SPA dist to Electron..." -ForegroundColor Cyan
    $source = "spa\dist"
    $destination = "fresh-migrated\electron\app"
    
    if (-not (Test-Path $source)) {
        throw "Source directory not found: $source"
    }
    
    Copy-Item -Path "$source\*" -Destination $destination -Recurse -Force
    Write-Host "? Files copied to Electron app directory" -ForegroundColor Green
}

function Setup-Electron {
    Write-Host "?? Setting up Electron dependencies..." -ForegroundColor Cyan
    Push-Location fresh-migrated\electron
    try {
        npm install
        npm run build
        Write-Host "? Electron setup complete" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Start-Electron {
    Write-Host "?? Starting Electron in dev mode..." -ForegroundColor Cyan
    Push-Location fresh-migrated\electron
    try {
        npm run electron:start
    }
    finally {
        Pop-Location
    }
}

function Full-Dev {
    Write-Host @"
??????????????????????????????????????????????????????????????????
?          Starting Complete Development Environment             ?
??????????????????????????????????????????????????????????????????
"@ -ForegroundColor Yellow
    
    Build-SPA
    Copy-ToElectron
    Setup-Electron
    Start-Electron
}

function Rebuild-All {
    Write-Host "?? Cleaning build artifacts..." -ForegroundColor Cyan
    
    # Clean SPA
    Remove-Item -Path spa\dist -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cleaned spa/dist" -ForegroundColor Gray
    
    # Clean Electron
    Remove-Item -Path fresh-migrated\electron\build -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path fresh-migrated\electron\app -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Cleaned electron build and app directories" -ForegroundColor Gray
    
    Write-Host "? Clean complete" -ForegroundColor Green
    
    # Start fresh build
    Full-Dev
}

function Clean-Build {
    Write-Host "?? Cleaning build artifacts..." -ForegroundColor Cyan
    
    Remove-Item -Path spa\dist -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path fresh-migrated\electron\build -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path fresh-migrated\electron\app -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "? Clean complete" -ForegroundColor Green
}

# Main execution
switch ($Command) {
    'build-spa' { Build-SPA; Copy-ToElectron }
    'start-electron' { Start-Electron }
    'full-dev' { Full-Dev }
    'rebuild' { Rebuild-All }
    'clean' { Clean-Build }
    'help' { Show-Help }
    default { Show-Help }
}
