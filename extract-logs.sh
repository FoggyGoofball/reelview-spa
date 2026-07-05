#!/bin/bash
# Extract overlay logs from device localStorage via adb

ADB_PATH="${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe"

echo "Pulling localStorage database from device..."

# The WebView stores data in /data/data/com.reelview.app/app_webview/Local\ Storage/
# We'll try to dump it via adb

echo "Attempting to extract logs from device..."

# Try to get the Chrome user data
$ADB_PATH pull "/data/data/com.reelview.app/app_webview/" "./device_webview_data/" 2>/dev/null || true

if [ -d "./device_webview_data" ]; then
    echo "? WebView data extracted"
    find ./device_webview_data -type f -name "*" | head -20
else
    echo "Could not extract WebView data directly"
    echo "Alternative: Use JavaScript to export logs"
    echo ""
    echo "In the app console, run:"
    echo "  window.__saveOverlayLogsToStorage()"
    echo "  window.__getOverlayLogsFromStorage()"
fi
