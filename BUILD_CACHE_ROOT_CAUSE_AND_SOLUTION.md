# Build Cache Hell - Root Cause Analysis & Permanent Solution

## THE PROBLEM

You keep seeing old package hashes (e.g., `index-TofgVzs1.js`) even after building new code because of **multiple caching layers that don't talk to each other**:

### Layer 1: Vite Build Cache
- Location: `spa/.vite/` or `spa/node_modules/.vite/`
- Issue: Caches compiled JS/CSS artifacts
- When it fails: Vite rebuilds but outputs same hash due to content-hashing

### Layer 2: Android Asset Sync Cache
- Location: `android/app/src/main/assets/public/assets/`
- Issue: Stores the synced SPA dist files
- When it fails: Old www/ files stay if sync didn't happen BEFORE build

### Layer 3: Gradle Asset Merge Cache
- Location: `android/app/build/intermediates/assets/debug/mergeDebugAssets/`
- Issue: Gradle's `mergeDebugAssets` task uses timestamp-based UP-TO-DATE checking
- When it fails: If this folder exists, Gradle thinks "nothing changed" even if www/ is newer

### Layer 4: Gradle Compressed Assets Cache
- Location: `android/app/build/intermediates/compressed_assets/debug/`
- Issue: Cached .jar files compiled from assets
- When it fails: Even if mergeDebugAssets ran, this might still be stale

### Layer 5: Android Studio/IDE Cache
- Location: `~/.gradle/`, `~/.android/`, project `.idea/` folder
- Issue: IDE caches build artifacts
- When it fails: Even clean builds don't fully clear it

---

## ROOT CAUSE TIMELINE

**What happened in your case:**

1. **1/7 @ 1:20 PM**: Old SPA built with hash `TofgVzs1`
   - Built in original `reelview` repo
   - Synced to `reelview/android/app/src/main/assets/public/assets/`
   - APK built successfully

2. **1/8 @ 9:47 AM**: New SPA built with hash `D9Wy0VnG`
   - Built in `reelview` repo
   - Synced to `reelview-final/www/` folder

3. **CRITICAL MISTAKE**: APK was built BEFORE cleaning Gradle cache
   - Gradle's `mergeDebugAssets` saw existing files from 1/7
   - It compared timestamps and found nothing "new" to merge
   - Old assets stayed in the build
   - New assets in www/ were never copied to Android assets

4. **1/8 @ 10:05 AM**: `./gradlew clean assembleDebug` PARTIALLY cleaned
   - `clean` task deleted `build/` folder (good)
   - But `src/main/assets/` was NOT cleaned (it's source, not build output)
   - Old files still in `android/app/src/main/assets/public/assets/index-TofgVzs1.js`
   - New build re-used those old files

---

## THE PERMANENT SOLUTION

### Solution 1: Two-Step Asset Sync (Critical)

**BEFORE EVERY APK BUILD**, run this sequence:

```bash
# Step 1: Build SPA (produces new assets)
cd spa
npm run build

# Step 2: CLEAN old assets from Android
rm -rf ../android/app/src/main/assets/public/assets/*

# Step 3: SYNC new assets
cp -r dist/assets/* ../android/app/src/main/assets/public/assets/

# Step 4: CLEAN Gradle cache
cd ../android
./gradlew clean

# Step 5: BUILD APK
./gradlew assembleDebug
```

### Solution 2: Automated Build Script (Recommended)

Create `spa/build-and-sync-android.sh`:

```bash
#!/bin/bash
set -e

echo "=== STEP 1: Building SPA ==="
npm run build
echo "? SPA build complete"

echo ""
echo "=== STEP 2: Backing up old Android assets ==="
ANDROID_ASSETS="../android/app/src/main/assets/public/assets"
if [ -d "$ANDROID_ASSETS" ]; then
    BACKUP_DIR="../android/app/src/main/assets/public/assets.backup.$(date +%s)"
    cp -r "$ANDROID_ASSETS" "$BACKUP_DIR"
    echo "? Backed up old assets to: $BACKUP_DIR"
fi

echo ""
echo "=== STEP 3: NUKING old Android assets ==="
rm -rf "$ANDROID_ASSETS"
mkdir -p "$ANDROID_ASSETS"
echo "? Old assets removed"

echo ""
echo "=== STEP 4: Syncing new assets ==="
cp -r dist/assets/* "$ANDROID_ASSETS/"
cp dist/index.html "$ANDROID_ASSETS/index.html"
echo "? New assets synced"

echo ""
echo "=== STEP 5: Verifying asset hash ==="
NEW_HASH=$(ls dist/assets/index-*.js | sed 's/.*index-//' | sed 's/.js//')
echo "? New asset hash: $NEW_HASH"

echo ""
echo "=== STEP 6: Cleaning Gradle cache ==="
cd ../android
./gradlew clean
echo "? Gradle cache cleaned"

echo ""
echo "=== STEP 7: Building APK ==="
./gradlew assembleDebug
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    echo "? APK built successfully: $APK_PATH"
else
    echo "? APK build failed"
    exit 1
fi

echo ""
echo "=== STEP 8: Verifying APK contains correct assets ==="
unzip -l "$APK_PATH" | grep "index-$NEW_HASH.js" > /dev/null
if [ $? -eq 0 ]; then
    echo "? APK contains correct asset hash: $NEW_HASH"
else
    echo "? APK does NOT contain correct asset hash!"
    echo "? APK probably contains old assets"
    exit 1
fi

echo ""
echo "=========================================="
echo "? BUILD COMPLETE AND VERIFIED"
echo "=========================================="
echo "Asset Hash: $NEW_HASH"
echo "APK Path: $APK_PATH"
```

### Solution 3: Windows Batch Version (For Your Setup)

Create `build-and-sync-android.bat`:

```batch
@echo off
setlocal enabledelayedexpansion

echo === STEP 1: Building SPA ===
cd spa
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: SPA build failed
    exit /b 1
)
echo OK: SPA build complete
cd ..

echo.
echo === STEP 2: Nuking old Android assets ===
set ANDROID_ASSETS=android\app\src\main\assets\public\assets
if exist "%ANDROID_ASSETS%" (
    echo Deleting: %ANDROID_ASSETS%
    rmdir /s /q "%ANDROID_ASSETS%"
)
mkdir "%ANDROID_ASSETS%"
echo OK: Old assets removed

echo.
echo === STEP 3: Syncing new assets ===
xcopy /E /I /Y "spa\dist\assets\*" "%ANDROID_ASSETS%"
copy /Y "spa\dist\index.html" "%ANDROID_ASSETS%\index.html"
echo OK: New assets synced

echo.
echo === STEP 4: Extracting new asset hash ===
for /f "delims=" %%A in ('dir /b spa\dist\assets\index-*.js') do (
    set FILENAME=%%A
)
for /f "tokens=2 delims=-" %%A in ("!FILENAME!") do (
    set HASH=%%A
    set HASH=!HASH:.js=!
)
echo OK: New asset hash is: !HASH!

echo.
echo === STEP 5: Cleaning Gradle cache ===
cd android
call .\gradlew.bat clean
if %errorlevel% neq 0 (
    echo ERROR: Gradle clean failed
    exit /b 1
)
echo OK: Gradle cache cleaned
cd ..

echo.
echo === STEP 6: Building APK ===
cd android
call .\gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo ERROR: APK build failed
    exit /b 1
)
echo OK: APK build complete
cd ..

echo.
echo === STEP 7: Verifying APK asset hash ===
for /f "delims=" %%A in ('PowerShell -Command "$zip = [System.IO.Compression.ZipFile]::OpenRead('android\app\build\outputs\apk\debug\app-debug.apk'); $zip.Entries | Where-Object { $_.Name -like 'index-!HASH!.js' } | Select-Object -First 1"') do (
    if "%%A" neq "" (
        echo OK: APK contains correct asset: !HASH!
        goto verified
    )
)
echo ERROR: APK does not contain expected asset hash: !HASH!
exit /b 1

:verified
echo.
echo ==========================================
echo OK: BUILD COMPLETE AND VERIFIED
echo ==========================================
echo Asset Hash: !HASH!
echo APK Path: android\app\build\outputs\apk\debug\app-debug.apk
echo.
```

---

## CHECKLIST: Before Every APK Build

- [ ] **SPA code changes saved** - edit, don't forget to save
- [ ] **Run `npm run build`** in spa/ folder - verify hash changes in output
- [ ] **Check www/ folder** - `ls www/assets/` shows NEW hash
- [ ] **Delete android/app/src/main/assets/** - CRITICAL step
- [ ] **Copy spa/dist/assets/* to android/app/src/main/assets/** - all files
- [ ] **Run `./gradlew clean`** in android/ folder - wait for completion
- [ ] **Check android/app/build/ doesn't exist** - verify clean worked
- [ ] **Run `./gradlew assembleDebug`** - full build
- [ ] **Verify APK contains new hash** - unzip and check assets
- [ ] **Verify on device** - logcat shows index-D9Wy0VnG.js (new hash)

---

## Why This Happens (The Technical Truth)

Gradle's **incremental build system** is optimized for speed by skipping tasks if inputs haven't changed. The issue:

1. Task: `mergeDebugAssets`
2. Input: Files in `android/app/src/main/assets/`
3. Output: `android/app/build/intermediates/assets/debug/`
4. Problem: If output folder already exists, Gradle checks timestamps
5. If `android/app/src/main/assets/` is OLDER than the output, Gradle marks task as UP-TO-DATE
6. Result: New SPA assets are never copied into the build

**The source of old assets in `android/app/src/main/assets/` is:**
- From the initial Android setup (Capacitor sync)
- From previous builds that copied old SPA assets there
- Never automatically cleaned because it's the SOURCE not the BUILD OUTPUT

---

## AUTOMATION: Add to package.json

In `spa/package.json`, add a new script:

```json
{
  "scripts": {
    "build": "vite build",
    "build:android": "npm run build && npm run sync:android && npm run verify:android",
    "sync:android": "node scripts/sync-android-assets.js",
    "verify:android": "node scripts/verify-android-assets.js",
    "clean:android": "rimraf ../android/app/src/main/assets/public/assets && mkdir -p ../android/app/src/main/assets/public/assets"
  }
}
```

Then create `spa/scripts/sync-android-assets.js`:

```javascript
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../dist/assets');
const DEST = path.join(__dirname, '../../android/app/src/main/assets/public/assets');

console.log('=== SYNCING ANDROID ASSETS ===');
console.log(`FROM: ${SRC}`);
console.log(`TO: ${DEST}`);

// Ensure destination exists
if (!fs.existsSync(DEST)) {
    fs.mkdirSync(DEST, { recursive: true });
    console.log('? Created destination directory');
}

// Copy all files
const files = fs.readdirSync(SRC);
files.forEach(file => {
    const src = path.join(SRC, file);
    const dest = path.join(DEST, file);
    fs.copyFileSync(src, dest);
    console.log(`? Copied: ${file}`);
});

// Verify
const destFiles = fs.readdirSync(DEST);
const indexFile = destFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
if (indexFile) {
    const hash = indexFile.match(/index-(.+)\.js/)[1];
    console.log(`? Verified: ${indexFile}`);
    console.log(`? Asset hash: ${hash}`);
} else {
    console.error('? ERROR: index-*.js not found!');
    process.exit(1);
}

console.log('? Sync complete');
```

---

## IMMEDIATE ACTION (Right Now)

1. Delete: `android/app/src/main/assets/public/assets/index-TofgVzs1.js`
2. Delete: `android/app/build/` folder completely
3. Run: `cd android && ./gradlew clean`
4. Run: `cd spa && npm run build`
5. Copy: `spa/dist/assets/*` to `android/app/src/main/assets/public/assets/`
6. Run: `cd android && ./gradlew assembleDebug`
7. Verify: Logcat shows `index-D9Wy0VnG.js` (NEW hash)

---

## PREVENTION: Going Forward

**Use the automated script for ALL future builds.** This prevents 100% of this issue.

The root cause is **manual steps** between SPA build and APK build. Automation removes the human factor.

