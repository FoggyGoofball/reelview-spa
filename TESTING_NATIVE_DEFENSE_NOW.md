# ?? NATIVE OVERLAY DEFENSE - LIVE TESTING

## What To Do On Your Phone RIGHT NOW

### Step 1: Open Reelview App
- Look for the Reelview icon on your home screen
- Tap to open

### Step 2: Navigate to a Movie or TV Show
- Go to Movies, TV, or Anime section
- Pick any title
- Click on it to open details

### Step 3: Click PLAY
- Click the blue PLAY button
- This will load an embed from vidsrc, vidlink, or mostream
- **This is where the magic happens!**

### Step 4: Observe
- ? **Watch page should load smoothly** (no red error screen)
- ? **Embed should appear** (video player visible)
- ? **Try clicking the overlay area** (click should pass through to video controls)
- ? **Try playing the video** (should work normally)

---

## Real-Time Log Monitoring

Open a terminal and run this command to watch for defense activation:

```powershell
$adbPath = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adbPath logcat -c
& $adbPath logcat | Select-String "DEFENSE"
```

### Expected Log Output

When you click PLAY on a video embed:

```
[DEFENSE] Overlay defense system initializing...
[DEFENSE] MutationObserver started
[DEFENSE] Overlay defense system fully initialized
[DEFENSE] Neutralized 3 overlay elements
[DEFENSE] Jailed ad: https://ads.example.com/...
```

### What Each Line Means

| Log | Meaning |
|-----|---------|
| `initializing...` | Defense script started loading |
| `MutationObserver started` | System watching for DOM changes |
| `fully initialized` | Defense is active and monitoring |
| `Neutralized X overlay` | Click-intercepting overlays found and hidden |
| `Jailed ad` | External navigation attempt caught and contained |

---

## Testing Checklist

While monitoring logs, try these on your phone:

### Test 1: Page Loads
- [ ] Watch page appears without red error screen
- ? **If you see error boundary, native system needs restart**

### Test 2: Embed Loads
- [ ] Video player visible in embed area
- ? **Check logcat for `INTERCEPTING EMBED` message**

### Test 3: Overlay Detection
- [ ] Logcat shows `Overlay defense system fully initialized`
- ? **If no DEFENSE logs, embed might not have loaded**

### Test 4: Click Through
- [ ] Try clicking where an overlay would be (usually top-left/corners)
- ? **Click should reach video controls underneath**
- ? **If overlay is clickable, native injection might have failed**

### Test 5: Playback
- [ ] Video plays smoothly
- [ ] All controls work (play, pause, seek, volume)
- ? **Zero lag or stuttering**

---

## Troubleshooting

### "I don't see DEFENSE logs"

**Reason:** Embed might not be intercepted properly

**Check:**
```powershell
# Look for this instead:
$adbPath logcat | Select-String "INTERCEPTING EMBED"
```

If you see `INTERCEPTING EMBED`, the native system IS working, just the defense might not be logging visibly.

### "Watch page crashes (red error screen)"

**This should NOT happen with native system!**

**Check:**
- Is the overlay-neutralizer still trying to initialize from React?
- Check `spa/src/pages/Watch.tsx` - should NOT have overlay init code
- Rebuild if needed: `npm run build` ? `gradlew assembleDebug` ? `adb install`

### "Overlay still blocks clicks"

**Possible reasons:**
1. Defense script didn't inject (check logs)
2. Overlay detection heuristics don't match this embed
3. Embed provider not in EMBED_DOMAINS list

**Check:**
```powershell
# Look for:
$adbPath logcat | Select-String "Neutralized.*overlay"
```

---

## Console Commands (Browser Console on PC)

If you have a browser connected to the app:

```javascript
// Check if defense was injected
window.__DEFENSE_ACTIVE === true

// Get last error
window.__LAST_DEFENSE_ERROR

// Check overlay count
window.__OVERLAY_COUNT
```

---

## NEXT: Just Follow These Steps

1. **On your phone:** Open Reelview ? Pick a movie ? Click PLAY
2. **On your computer:** Run the logcat monitoring command
3. **Watch the logs** as the embed loads
4. **Report what you see** (DEFENSE logs or INTERCEPTING EMBED logs)

This will tell us if the native system is working! ??

