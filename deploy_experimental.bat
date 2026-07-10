@echo off
cd /d c:\Users\Admin\Downloads\reelview\spa\dist
git init
git remote add origin https://github.com/FoggyGoofball/reelview-experimental.git
git add -A
git commit -m "fix: skip SW conversion for backend proxy URLs, add VLC button"
git branch -M main
git push -f origin main:gh-pages
echo DONE
