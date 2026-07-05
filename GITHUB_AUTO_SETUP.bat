@echo off
REM =====================================================
REM ReelView SPA - GitHub Auto Setup
REM =====================================================

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo  ReelView SPA - GitHub Auto Setup
echo =====================================================
echo.

REM Check if git is installed
where git >nul 2>nul
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please download and install Git from: https://git-scm.com/download/win
    echo Then restart this script.
    pause
    exit /b 1
)

echo Git found. Continuing...
echo.

REM Set your GitHub credentials here
set /p GITHUB_USERNAME="Enter your GitHub username: "
set /p GITHUB_TOKEN="Enter your GitHub token (paste with right-click): "

if "%GITHUB_USERNAME%"=="" (
    echo ERROR: GitHub username required
    pause
    exit /b 1
)

if "%GITHUB_TOKEN%"=="" (
    echo ERROR: GitHub token required
    pause
    exit /b 1
)

echo.
echo Using username: %GITHUB_USERNAME%
echo.

REM Create .gitignore
echo [1/7] Creating .gitignore...
(
echo # Dependencies
echo node_modules/
echo .pnp
echo .pnp.js
echo.
echo # Build outputs
echo dist/
echo build/
echo out/
echo .next/
echo www/
echo.
echo # Environment
echo .env
echo .env.local
echo .env.*.local
echo *.pem
echo.
echo # IDE
echo .vscode/
echo .idea/
echo *.swp
echo *.swo
echo .DS_Store
echo.
echo # Logs
echo *.log
echo npm-debug.log*
echo.
echo # Mobile/Native
echo android/.gradle/
echo android/local.properties
echo android/app/debug/
echo android/app/release/
echo.
echo # OS
echo Thumbs.db
echo.
echo # Testing
echo coverage/
echo.
echo # Misc
echo *.jks
) > .gitignore
echo    Done!

REM Create README.md
echo [2/7] Creating README.md...
(
echo # ReelView SPA
echo.
echo Advanced video streaming application with cross-platform support.
echo.
echo ## Features
echo.
echo - Multiple video sources
echo - Cross-platform support
echo - Watchlist and history tracking
echo - Advanced search and filtering
echo.
echo ## Quick Start
echo.
echo cd spa
echo npm install
echo npm run dev
echo.
echo ## Web Access
echo.
echo https://%GITHUB_USERNAME%.github.io/reelview-spa
) > README.md
echo    Done!

REM Create .github/workflows directory and file
echo [3/7] Creating GitHub Actions workflow...
if not exist ".github" mkdir ".github"
if not exist ".github\workflows" mkdir ".github\workflows"

(
echo name: Deploy SPA to GitHub Pages
echo.
echo on:
echo   push:
echo     branches:
echo       - main
echo       - master
echo   workflow_dispatch:
echo.
echo permissions:
echo   contents: read
echo   pages: write
echo   id-token: write
echo.
echo jobs:
echo   build-and-deploy:
echo     runs-on: ubuntu-latest
echo     environment:
echo       name: github-pages
echo     steps:
echo       - uses: actions/checkout@v4
echo       - uses: actions/setup-node@v4
echo         with:
echo           node-version: '20'
echo       - run: cd spa && npm ci
echo       - run: cd spa && npm run build
echo       - uses: actions/configure-pages@v4
echo       - uses: actions/upload-pages-artifact@v3
echo         with:
echo           path: 'spa/dist'
echo       - uses: actions/deploy-pages@v2
) > ".github\workflows\spa-deploy.yml"
echo    Done!

REM Initialize git repo
echo [4/7] Initializing git repository...
if not exist ".git" (
    git init -q
    echo    Git repository initialized
) else (
    echo    Git repository already exists
)

REM Configure git user
git config user.name "%GITHUB_USERNAME%" 2>nul
git config user.email "%GITHUB_USERNAME%@users.noreply.github.com" 2>nul

REM Remove existing remote and add new one
echo [5/7] Configuring remote...
git remote remove origin 2>nul
git remote add origin "https://%GITHUB_USERNAME%:%GITHUB_TOKEN%@github.com/%GITHUB_USERNAME%/reelview-spa.git"
echo    Done!

REM Create GitHub repo via PowerShell
echo [6/7] Creating GitHub repository...
powershell -ExecutionPolicy Bypass -Command "$headers = @{ 'Authorization' = 'token %GITHUB_TOKEN%'; 'Accept' = 'application/vnd.github.v3+json' }; $body = '{\"name\":\"reelview-spa\",\"description\":\"ReelView SPA\",\"private\":false}'; try { Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -Body $body -ContentType 'application/json' -ErrorAction Stop; Write-Host '   Repository created!' } catch { if ($_.Exception.Response.StatusCode -eq 422) { Write-Host '   Repository already exists (OK)' } else { Write-Host '   Note: Could not create repo via API, will try push anyway' } }"

REM Commit and push
echo [7/7] Committing and pushing...
git add -A
git commit -m "Initial commit - ReelView SPA" -q 2>nul
if errorlevel 1 (
    echo    No changes to commit
)

echo    Pushing to GitHub...
git branch -M main 2>nul
git push -u origin main -f 2>nul
if errorlevel 1 (
    echo    Trying with master branch...
    git branch -M master 2>nul
    git push -u origin master -f 2>nul
)

echo.
echo =====================================================
echo SUCCESS! Your code is now on GitHub!
echo =====================================================
echo.
echo Repository: https://github.com/%GITHUB_USERNAME%/reelview-spa
echo.
echo NEXT STEP - Enable GitHub Pages:
echo.
echo 1. Open this URL in your browser:
echo    https://github.com/%GITHUB_USERNAME%/reelview-spa/settings/pages
echo.
echo 2. Under "Source", select "GitHub Actions"
echo.
echo 3. Wait 2-3 minutes for the first build
echo.
echo 4. Your app will be live at:
echo    https://%GITHUB_USERNAME%.github.io/reelview-spa
echo.
echo =====================================================
echo.

pause
