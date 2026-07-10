#!/usr/bin/env python3
"""Deploy spa/dist to gh-pages branch of reelview-experimental"""
import os, subprocess, shutil, tempfile

REPO_URL = "https://github.com/FoggyGoofball/reelview-experimental.git"
DIST_DIR = r"c:\Users\Admin\Downloads\reelview\spa\dist"

# Create temp dir, init git, copy dist contents, force push
tmpdir = tempfile.mkdtemp(prefix="gh_deploy_")
print(f"[deploy] Working in {tmpdir}")

os.chdir(tmpdir)
subprocess.run(["git", "init", "-b", "main"], capture_output=True)
subprocess.run(["git", "config", "user.name", "deploy-bot"], capture_output=True)
subprocess.run(["git", "config", "user.email", "bot@example.com"], capture_output=True)

# Copy dist contents (including assets/) into temp dir
for item in os.listdir(DIST_DIR):
    src = os.path.join(DIST_DIR, item)
    dst = os.path.join(tmpdir, item)
    if os.path.isdir(src):
        shutil.copytree(src, dst, symlinks=True)
    else:
        shutil.copy2(src, dst)

# Verify index.html is there
print(f"[deploy] Files: {os.listdir(tmpdir)}")
print(f"[deploy] index.html exists: {os.path.isfile('index.html')}")
print(f"[deploy] assets dir: {os.listdir('assets') if os.path.isdir('assets') else 'MISSING'}")

subprocess.run(["git", "add", "-A"])
subprocess.run(["git", "commit", "-m", "fix: skip SW conversion for backend proxy URLs, add VLC button"])
result = subprocess.run(
    ["git", "remote", "add", "origin", REPO_URL],
    capture_output=True, text=True
)
print(f"[deploy] remote add: {result.stdout} {result.stderr}")

result = subprocess.run(
    ["git", "push", "-f", "origin", "main:gh-pages"],
    capture_output=True, text=True
)
print(f"[deploy] push stdout: {result.stdout}")
print(f"[deploy] push stderr: {result.stderr}")
print(f"[deploy] push returncode: {result.returncode}")

# Cleanup
shutil.rmtree(tmpdir, ignore_errors=True)
print("[deploy] Done!")
