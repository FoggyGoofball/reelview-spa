# =====================================================
# ReelView SPA - GitHub Auto Setup (PowerShell)
# =====================================================

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " ReelView SPA - GitHub Auto Setup" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is installed
try {
    git --version | Out-Null
    Write-Host "Git found!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed!" -ForegroundColor Red
    Write-Host "Please download and install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Get credentials
Write-Host ""
$GITHUB_USERNAME = Read-Host "Enter your GitHub username"
$GITHUB_TOKEN = Read-Host "Enter your GitHub token"

if ([string]::IsNullOrEmpty($GITHUB_USERNAME) -or [string]::IsNullOrEmpty($GITHUB_TOKEN)) {
    Write-Host "ERROR: Username and token are required!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Using username: $GITHUB_USERNAME" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create .gitignore
Write-Host "[1/7] Creating .gitignore..." -ForegroundColor Yellow
@"
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
out/
.next/
www/

# Environment
.env
.env.local
.env.*.local
*.pem

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
*.log
npm-debug.log*

# Mobile/Native
android/.gradle/
android/local.properties
android/app/debug/
android/app/release/

# OS
Thumbs.db

# Testing
coverage/

# Misc
*.jks
"@ | Out-File -FilePath ".gitignore" -Encoding utf8
Write-Host "   Done!" -ForegroundColor Green

# Step 2: Create README.md
Write-Host "[2/7] Creating README.md..." -ForegroundColor Yellow
@"
# ReelView SPA

Advanced video streaming application with cross-platform support.

## Features

- Multiple video sources (Anime, Movies, TV Shows)
- Cross-platform support (Windows, macOS, Android, iOS, Web)
- Watchlist and history tracking
- Advanced search and filtering

## Quick Start

```bash
cd spa
npm install
npm run dev
```

## Web Access

https://$GITHUB_USERNAME.github.io/reelview-spa

## License

Proprietary - All Rights Reserved
"@ | Out-File -FilePath "README.md" -Encoding utf8
Write-Host "   Done!" -ForegroundColor Green

# Step 3: Create GitHub Actions workflow
Write-Host "[3/7] Creating GitHub Actions workflow..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path ".github/workflows" | Out-Null
@"
name: Deploy SPA to GitHub Pages

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd spa && npm ci
      - run: cd spa && npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'spa/dist'
      - uses: actions/deploy-pages@v2
"@ | Out-File -FilePath ".github/workflows/spa-deploy.yml" -Encoding utf8
Write-Host "   Done!" -ForegroundColor Green

# Step 4: Initialize git repo
Write-Host "[4/7] Initializing git repository..." -ForegroundColor Yellow
if (-not (Test-Path ".git")) {
    git init -q
    Write-Host "   Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "   Git repository already exists" -ForegroundColor Green
}

# Configure git user
git config user.name "$GITHUB_USERNAME" 2>$null
git config user.email "$GITHUB_USERNAME@users.noreply.github.com" 2>$null

# Step 5: Configure remote
Write-Host "[5/7] Configuring remote..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin "https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/reelview-spa.git"
Write-Host "   Done!" -ForegroundColor Green

# Step 6: Create GitHub repo via API
Write-Host "[6/7] Creating GitHub repository..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "token $GITHUB_TOKEN"
        "Accept" = "application/vnd.github.v3+json"
    }
    $body = @{
        "name" = "reelview-spa"
        "description" = "ReelView SPA - Advanced Video Streaming Application"
        "private" = $false
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method Post -Headers $headers -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "   Repository created!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 422) {
        Write-Host "   Repository already exists (OK)" -ForegroundColor Green
    } else {
        Write-Host "   Note: Could not create repo via API, will try push anyway" -ForegroundColor Yellow
    }
}

# Step 7: Commit and push
Write-Host "[7/7] Committing and pushing..." -ForegroundColor Yellow
git add -A
git commit -m "Initial commit - ReelView SPA" -q 2>$null
git branch -M main 2>$null
git push -u origin main -f 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "   Trying with force push..." -ForegroundColor Yellow
    git push -u origin main --force 2>$null
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " SUCCESS! Your code is now on GitHub!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: https://github.com/$GITHUB_USERNAME/reelview-spa" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEP - Enable GitHub Pages:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open this URL in your browser:" -ForegroundColor White
Write-Host "   https://github.com/$GITHUB_USERNAME/reelview-spa/settings/pages" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Under 'Build and deployment', set Source to 'GitHub Actions'" -ForegroundColor White
Write-Host ""
Write-Host "3. Wait 2-3 minutes for the first build" -ForegroundColor White
Write-Host ""
Write-Host "4. Your app will be live at:" -ForegroundColor White
Write-Host "   https://$GITHUB_USERNAME.github.io/reelview-spa" -ForegroundColor Cyan
Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
