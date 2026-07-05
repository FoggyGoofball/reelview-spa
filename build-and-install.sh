#!/bin/bash
# Build and Install Latest ReelView APK

set -e  # Exit on error

echo "=== ReelView Build & Install Script ==="
echo ""

# Get absolute path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR"

echo "[1/5] Cleaning previous build..."
cd "$PROJECT_ROOT/android"
./gradlew clean --no-daemon -q

echo "[2/5] Building APK (Release)..."
./gradlew assembleDebug --no-daemon -x lint

echo "[3/5] Checking APK..."
APK_PATH="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo "? APK not found at $APK_PATH"
    exit 1
fi
echo "? APK found: $(ls -lh $APK_PATH | awk '{print $5, $9}')"

echo "[4/5] Installing APK..."
adb install -r "$APK_PATH"

echo "[5/5] Launching app..."
adb shell am start -n com.reelview.app/.MainActivity

echo ""
echo "? Build and install complete!"
echo "App should now be running on your device"
