#!/bin/bash
# GitHub Setup & Deployment Automation
# Initializes repo, sets up CI/CD, and configures GitHub Pages

set -e

echo "=========================================="
echo "ReelView GitHub Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_NAME="reelview"
GITHUB_USERNAME=""
GITHUB_TOKEN=""

# Step 1: Get GitHub credentials
echo -e "${YELLOW}Step 1: GitHub Credentials${NC}"
read -p "GitHub Username: " GITHUB_USERNAME
read -sp "GitHub Personal Access Token (with repo scope): " GITHUB_TOKEN
echo ""

if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}Error: GitHub credentials required${NC}"
    exit 1
fi

# Step 2: Initialize git repo locally
echo -e "${YELLOW}Step 2: Initializing Local Git Repository${NC}"
cd "$(dirname "$0")"

if [ ! -d ".git" ]; then
    git init
    git config user.name "$GITHUB_USERNAME"
    git config user.email "$GITHUB_USERNAME@users.noreply.github.com"
    echo -e "${GREEN}? Git repository initialized${NC}"
else
    echo -e "${GREEN}? Git repository already exists${NC}"
fi

# Step 3: Create GitHub repo via API
echo -e "${YELLOW}Step 3: Creating GitHub Repository${NC}"

REPO_CREATE_RESPONSE=$(curl -s -X POST \
  https://api.github.com/user/repos \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d "{
    \"name\": \"$REPO_NAME\",
    \"description\": \"ReelView - Advanced Video Streaming Application\",
    \"private\": false,
    \"has_issues\": true,
    \"has_projects\": true,
    \"has_downloads\": true,
    \"homepage\": \"https://$GITHUB_USERNAME.github.io/$REPO_NAME\"
  }")

REPO_URL=$(echo $REPO_CREATE_RESPONSE | grep -o '"clone_url":"[^"]*' | cut -d'"' -f4)

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}Error creating repository. Response: $REPO_CREATE_RESPONSE${NC}"
    exit 1
fi

echo -e "${GREEN}? Repository created: $REPO_URL${NC}"

# Step 4: Add remote and configure
echo -e "${YELLOW}Step 4: Configuring Remote${NC}"

# Remove existing remote if it exists
git remote remove origin 2>/dev/null || true

# Add new remote with credentials embedded
REMOTE_URL="https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"
git remote add origin "$REMOTE_URL"

echo -e "${GREEN}? Remote configured${NC}"

# Step 5: Create .gitignore
echo -e "${YELLOW}Step 5: Creating .gitignore${NC}"

cat > .gitignore << 'EOF'
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
*~
.DS_Store

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*

# Mobile/Native
android/.gradle/
android/local.properties
android/app/debug/
android/app/release/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Misc
reelview-*.log
*.jks
EOF

echo -e "${GREEN}? .gitignore created${NC}"

# Step 6: Create README
echo -e "${YELLOW}Step 6: Creating README.md${NC}"

cat > README.md << 'EOF'
# ReelView

Advanced video streaming application with cross-platform support (Electron, Android, iOS).

## Features

- ?? Multiple video sources (Anime, Movies, TV Shows)
- ?? Cross-platform support (Windows, macOS, Android, iOS, Web)
- ?? HLS stream downloads with quality selection
- ?? Secure streaming with authentication
- ?? Beautiful UI with Tailwind CSS
- ?? Watchlist and history tracking
- ?? Advanced search and filtering

## Platforms

### Desktop (Electron)
- Windows EXE
- macOS DMG
- Linux AppImage

### Mobile (Capacitor)
- Android APK
- iOS IPA (via App Store)
- Web (via GitHub Pages)

## Web Access

Access the latest version via web browser:
- **GitHub Pages**: `https://<username>.github.io/reelview`
- **Mobile**: Open on iPhone/Android Chrome

## Quick Start

### Development
```bash
# SPA development
cd spa
npm install
npm run dev

# Electron development
npm run electron

# Android development
npx cap sync
cd android
./gradlew assembleDebug
```

### Build
```bash
# Build all platforms
./build-all.ps1  # Windows
./build-all.sh   # Unix

# Or build individually
npm run build:spa
npm run build:electron
npm run build:android
```

## Architecture

```
reelview/
??? spa/                 # React SPA (Vite)
??? fresh-migrated/      # Electron app
??? android/             # Android/Capacitor
??? docs/                # Documentation
??? build-*.ps1/sh       # Build automation
```

## Downloads

Latest releases available on [GitHub Releases](https://github.com/<username>/reelview/releases)

## License

Proprietary - All Rights Reserved

## Support

For issues and feature requests, see [GitHub Issues](https://github.com/<username>/reelview/issues)
EOF

echo -e "${GREEN}? README.md created${NC}"

# Step 7: Create GitHub Actions workflow for SPA deployment
echo -e "${YELLOW}Step 7: Setting up GitHub Actions${NC}"

mkdir -p .github/workflows

cat > .github/workflows/spa-deploy.yml << 'EOF'
name: Deploy SPA to GitHub Pages

on:
  push:
    branches:
      - main
      - master
    paths:
      - 'spa/**'
      - '.github/workflows/spa-deploy.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    name: Build and Deploy SPA
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'spa/package-lock.json'

      - name: Install dependencies
        run: cd spa && npm ci

      - name: Build SPA
        run: cd spa && npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'spa/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
EOF

echo -e "${GREEN}? GitHub Actions workflow created${NC}"

# Step 8: Add files and commit
echo -e "${YELLOW}Step 8: Initial Commit${NC}"

git add .gitignore README.md .github/

# Add all source files
git add -A
git status

echo ""
read -p "Review files above. Press Enter to commit and push..."

git commit -m "chore: initial commit with GitHub automation"

echo -e "${YELLOW}Pushing to GitHub...${NC}"
git push -u origin main 2>&1 || git push -u origin master

echo ""
echo -e "${GREEN}=========================================="
echo "? GitHub Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Repository: $REPO_URL"
echo ""
echo "Next steps:"
echo "1. Go to GitHub repository Settings"
echo "2. Enable GitHub Pages (Settings ? Pages)"
echo "3. Select 'Deploy from a branch'"
echo "4. Branch: gh-pages, folder: / (root)"
echo ""
echo "Web access will be available at:"
echo "https://$GITHUB_USERNAME.github.io/$REPO_NAME"
echo ""
