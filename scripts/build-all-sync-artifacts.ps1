param(
  [Parameter(Mandatory=$false)]
  [string]$SpaBaseUrl = "/reelview-final/",

  [Parameter(Mandatory=$false)]
  [switch]$SkipAndroid,

  [Parameter(Mandatory=$false)]
  [switch]$SkipElectron
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Run-Step([string]$name, [scriptblock]$action) {
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  & $action
  Write-Host "[OK] $name complete" -ForegroundColor Green
}

Run-Step "Build SPA" {
  Push-Location "$root/spa"
  try {
    $env:VITE_BASE_URL = $SpaBaseUrl
    npm run build
  }
  finally {
    Pop-Location
  }
}

if (-not $SkipAndroid) {
  Run-Step "Copy SPA dist to Android assets" {
    $source = "$root/spa/dist"
    $target = "$root/android/app/src/main/assets/public"

    if (Test-Path $target) {
      Remove-Item $target -Recurse -Force
    }

    New-Item -ItemType Directory -Path $target -Force | Out-Null
    Copy-Item "$source/*" $target -Recurse -Force
  }

  Run-Step "Build Android APK (debug)" {
    Push-Location "$root/android"
    try {
      .\gradlew.bat assembleDebug
    }
    finally {
      Pop-Location
    }
  }
}

if (-not $SkipElectron) {
  Run-Step "Build Electron installer" {
    Push-Location "$root/fresh-migrated/electron"
    try {
      npm run electron:make
    }
    finally {
      Pop-Location
    }
  }
}

Write-Host "`nArtifacts:" -ForegroundColor Yellow
Write-Host "- SPA: $root/spa/dist"
if (-not $SkipAndroid) {
  Write-Host "- Android APK: $root/android/app/build/outputs/apk/debug/app-debug.apk"
}
if (-not $SkipElectron) {
  Write-Host "- Electron installer output: $root/fresh-migrated/electron/dist"
}
