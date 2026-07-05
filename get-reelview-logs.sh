#!/bin/bash
# Extract logs from Reelview app on Android device

ADB="${LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe"

echo "?? Retrieving logs from Reelview app..."
echo ""

# Get the app's cache directory
APP_CACHE_DIR="/data/data/com.reelview.app/cache"

echo "Step 1: Creating temporary log file..."
$ADB shell "cat > /sdcard/reelview_logs.txt << 'EOF'
REELVIEW DEBUG LOGS - Auto-exported from localStorage
Generated: $(date)

To retrieve the logs from localStorage, the app must be running.
If not running, please start the app and wait 5 seconds.

EOF
"

echo "Step 2: Attempting to dump WebView localStorage..."
# Try to get WebView data
$ADB shell "find /data/data/com.reelview.app -name '*Local Storage*' -o -name '*localStorage*' 2>/dev/null | head -10"

echo ""
echo "Step 3: Pulling logs from device..."
$ADB pull "/sdcard/reelview_logs.txt" "./reelview_logs.txt" 2>/dev/null || true

echo ""
echo "? Log extraction complete!"
echo ""
echo "To get the actual logs:"
echo "1. Make sure the app is open and playing a video with ads"
echo "2. Wait 5 seconds for auto-export"
echo "3. Run this command in the browser console:"
echo "   console.log(JSON.stringify(window.__AUTO_EXPORT_LOGS(), null, 2))"
echo "4. Copy the output and save to a file"
echo ""
echo "Or pull the app's WebView database:"
$ADB shell "ls -la /data/data/com.reelview.app/app_webview/Local\ Storage/ 2>/dev/null" || echo "(WebView localStorage not accessible directly)"

echo ""
echo "?? Alternative: Logcat filter"
echo "Run: adb logcat | grep OVERLAY"
