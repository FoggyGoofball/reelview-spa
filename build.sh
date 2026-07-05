#!/bin/bash
# ReelView - Start Build Script (Linux/Mac)
# Usage: chmod +x build.sh && ./build.sh

set -e

echo ""
echo "??????????????????????????????????????????????????????????????"
echo "?         ReelView - Complete Build Automation              ?"
echo "?              Windows EXE + Android APK                    ?"
echo "??????????????????????????????????????????????????????????????"
echo ""

# Parse arguments
WINDOWS_ONLY=false
ANDROID_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --windows-only)
      WINDOWS_ONLY=true
      shift
      ;;
    --android-only)
      ANDROID_ONLY=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--windows-only] [--android-only] [--verbose]"
      exit 1
      ;;
  esac
done

# Check prerequisites
echo "??? CHECKING PREREQUISITES ???"
for cmd in node npm java; do
  if ! command -v $cmd &> /dev/null; then
    echo "[ERROR] $cmd not found. Please install it first."
    exit 1
  fi
  echo "[OK] $cmd found"
done

if [ -z "$ANDROID_HOME" ]; then
  echo "[WARNING] ANDROID_HOME not set. Android build will be skipped."
fi

# Use Node.js build script
echo ""
echo "Delegating to Node.js build script..."
echo ""

if [ "$VERBOSE" = true ]; then
  node build.js --verbose $([ "$WINDOWS_ONLY" = true ] && echo "--windows-only") $([ "$ANDROID_ONLY" = true ] && echo "--android-only")
else
  node build.js $([ "$WINDOWS_ONLY" = true ] && echo "--windows-only") $([ "$ANDROID_ONLY" = true ] && echo "--android-only")
fi

echo ""
echo "? Build completed!"
