#!/usr/bin/env python3
"""
ReelView SPA GitHub Setup - COMPLETELY AUTOMATED
No CLI interaction required after running this!
"""

import os
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime

# Configuration
REPO_NAME = "reelview-spa"
REPO_DESCRIPTION = "ReelView SPA - Advanced Video Streaming Application (Complete Rewrite)"
GITHUB_USERNAME = "YOUR_GITHUB_USERNAME"  # Will be set via environment
GITHUB_TOKEN = "YOUR_GITHUB_TOKEN"  # Will be set via environment

def print_header(text):
    """Print a nice header"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60 + "\n")

def print_step(num, text):
    """Print a step indicator"""
    print(f"? Step {num}: {text}")

def create_gitignore():
    """Create .gitignore file"""
    gitignore_content = """# Dependencies
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

# Documentation
docs/
"""
    
    with open('.gitignore', 'w') as f:
        f.write(gitignore_content)
    print_step(1, ".gitignore created")

def create_readme():
    """Create README.md"""
    readme_content = """# ReelView SPA

Advanced video streaming application with cross-platform support (Electron, Android, iOS, Web).

**This is a complete rewrite of the original ReelView project.**

## Features

- ?? Multiple video sources (Anime, Movies, TV Shows)
- ?? Cross-platform support (Windows, macOS, Android, iOS, Web)
- ?? HLS stream downloads with quality selection
- ?? Secure streaming with authentication
- ?? Beautiful UI with Tailwind CSS & React
- ?? Watchlist and history tracking
- ?? Advanced search and filtering
- ?? Continue watching functionality
- ?? Genre browsing and discovery

## Platforms

### Desktop (Electron)
- Windows EXE
- macOS DMG
- Linux AppImage

### Mobile (Capacitor)
- Android APK
- iOS IPA (via App Store)

### Web (GitHub Pages)
- Accessible via browser
- Mobile responsive
- Progressive Web App

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Desktop**: Electron
- **Mobile**: Capacitor (Android/iOS)
- **Video**: HLS streams with quality selection
- **API**: TMDB integration
- **Download**: FFmpeg + HLS downloader

## Project Structure

```
reelview-spa/
??? spa/                    # React SPA (Vite)
?   ??? src/
?   ?   ??? pages/
?   ?   ??? components/
?   ?   ??? lib/
?   ?   ??? hooks/
?   ?   ??? styles/
?   ??? public/
?   ??? index.html
??? fresh-migrated/         # Electron app
??? android/                # Capacitor/Android
??? .github/
?   ??? workflows/          # CI/CD
??? docs/                   # Documentation
```

## Quick Start

### Development
\`\`\`bash
cd spa
npm install
npm run dev
# Open http://localhost:5173
\`\`\`

### Build SPA
\`\`\`bash
npm run build
\`\`\`

### Build Electron
\`\`\`bash
npm run build:electron
\`\`\`

### Build Android
\`\`\`bash
npx cap sync
cd android
./gradlew assembleDebug
\`\`\`

## Web Access

Access the latest version via GitHub Pages:
- **URL**: `https://YOUR_USERNAME.github.io/reelview-spa`
- **Mobile**: Open on iPhone/Android Chrome

## API Key Setup

1. Get API key from [TMDB](https://www.themoviedb.org/settings/api)
2. Launch app and enter key in settings dialog
3. Key is stored in browser localStorage

## Downloads

Latest releases: [GitHub Releases](https://github.com/YOUR_USERNAME/reelview-spa/releases)

## License

Proprietary - All Rights Reserved

## Support

For issues: [GitHub Issues](https://github.com/YOUR_USERNAME/reelview-spa/issues)

---

**This is a complete rewrite with professional-grade architecture, cross-platform support, and automated CI/CD.**
"""
    
    with open('README.md', 'w') as f:
        f.write(readme_content)
    print_step(2, "README.md created")

def create_github_actions_workflow():
    """Create GitHub Actions CI/CD workflow"""
    workflow_content = """name: Deploy SPA to GitHub Pages

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
"""
    
    workflow_dir = Path('.github/workflows')
    workflow_dir.mkdir(parents=True, exist_ok=True)
    
    with open(workflow_dir / 'spa-deploy.yml', 'w') as f:
        f.write(workflow_content)
    print_step(3, "GitHub Actions workflow created")

def setup_git_repo(username, token):
    """Initialize and push git repo"""
    try:
        # Check if git is already initialized
        if not Path('.git').exists():
            subprocess.run(['git', 'init'], check=True, capture_output=True)
            subprocess.run(['git', 'config', 'user.name', username], check=True, capture_output=True)
            subprocess.run(['git', 'config', 'user.email', f'{username}@users.noreply.github.com'], check=True, capture_output=True)
            print_step(4, "Git repo initialized locally")
        
        # Add remote
        try:
            subprocess.run(['git', 'remote', 'remove', 'origin'], capture_output=True)
        except:
            pass
        
        remote_url = f"https://{username}:{token}@github.com/{username}/reelview-spa.git"
        subprocess.run(['git', 'remote', 'add', 'origin', remote_url], check=True, capture_output=True)
        print_step(5, "Remote configured")
        
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e}")
        return False
    
    return True

def create_github_repo(username, token):
    """Create GitHub repo via API"""
    import urllib.request
    import json as json_module
    
    try:
        url = 'https://api.github.com/user/repos'
        headers = {
            'Authorization': f'token {token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        data = {
            'name': REPO_NAME,
            'description': REPO_DESCRIPTION,
            'private': False,
            'has_issues': True,
            'has_projects': True,
            'has_downloads': True,
            'homepage': f'https://{username}.github.io/reelview-spa'
        }
        
        req = urllib.request.Request(
            url,
            data=json_module.dumps(data).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            result = json_module.loads(response.read().decode('utf-8'))
            print_step(6, f"GitHub repo created: {result.get('clone_url', 'Unknown URL')}")
            return True
    except Exception as e:
        print(f"GitHub API error: {e}")
        return False

def commit_and_push(username):
    """Commit and push to GitHub"""
    try:
        subprocess.run(['git', 'add', '.'], check=True, capture_output=True)
        subprocess.run(['git', 'commit', '-m', 'chore: initial commit - reelview spa complete rewrite'], check=True, capture_output=True)
        print_step(7, "Changes committed")
        
        # Try main first, then master
        try:
            subprocess.run(['git', 'push', '-u', 'origin', 'main'], check=True, capture_output=True)
            print_step(8, "Pushed to GitHub (main branch)")
        except:
            subprocess.run(['git', 'push', '-u', 'origin', 'master'], check=True, capture_output=True)
            print_step(8, "Pushed to GitHub (master branch)")
        
        return True
    except subprocess.CalledProcessError as e:
        print(f"Push error: {e}")
        return False

def main():
    """Main setup function"""
    print_header("ReelView SPA - GitHub Setup")
    
    # Get credentials from environment
    username = os.environ.get('GITHUB_USERNAME')
    token = os.environ.get('GITHUB_TOKEN')
    
    if not username or not token:
        print("? ERROR: Missing GitHub credentials!")
        print("\nSet environment variables:")
        print("  Windows (PowerShell): $env:GITHUB_USERNAME='your_username'")
        print("  Windows (PowerShell): $env:GITHUB_TOKEN='your_token'")
        print("  Mac/Linux: export GITHUB_USERNAME='your_username'")
        print("  Mac/Linux: export GITHUB_TOKEN='your_token'")
        sys.exit(1)
    
    # Change to repo directory
    os.chdir(Path(__file__).parent)
    
    # Run setup steps
    create_gitignore()
    create_readme()
    create_github_actions_workflow()
    
    if not create_github_repo(username, token):
        print("??  GitHub repo creation failed (may already exist)")
    
    if not setup_git_repo(username, token):
        print("? Git setup failed")
        sys.exit(1)
    
    if not commit_and_push(username):
        print("? Push failed")
        sys.exit(1)
    
    print_header("? Setup Complete!")
    print(f"Repository: https://github.com/{username}/reelview-spa")
    print(f"Web Access: https://{username}.github.io/reelview-spa")
    print("\nNext steps:")
    print("1. Go to: https://github.com/YOUR_USERNAME/reelview-spa/settings/pages")
    print("2. Set Source to: 'Deploy from a branch'")
    print("3. Select branch: 'main' or 'master'")
    print("4. Folder: '/' (root)")
    print("5. Click Save")
    print("6. Wait 5 minutes for first deployment")
    print("7. Your site will be live!")
    print("\n? All done! Your code is now on GitHub!")

if __name__ == '__main__':
    main()
