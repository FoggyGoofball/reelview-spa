# GitHub Pages Receiver URL - VERIFIED
## Exact URLs and Configuration

**Status:** ? **VERIFIED AND READY**

---

## GITHUB PAGES URL

### Primary Receiver URL
```
https://foggygoofball.github.io/reelview-final/chromecast-receiver.html
```

### With Video URL Parameter
```
https://foggygoofball.github.io/reelview-final/chromecast-receiver.html?url=https://example.com/video.m3u8
```

### Repository Information
| Item | Value |
|------|-------|
| **GitHub Username** | FoggyGoofball |
| **Repository Name** | reelview-final |
| **Pages Domain** | foggygoofball.github.io |
| **Source Folder** | /docs |
| **File Name** | chromecast-receiver.html |

---

## VERIFICATION

### Check in Browser
Open this URL and verify it loads:
```
https://foggygoofball.github.io/reelview-final/chromecast-receiver.html
```

Expected result:
- ? Page loads
- ? Black video player visible
- ? "Initializing Chromecast Receiver..." message
- ? No 404 errors

### Check File Location
```bash
# Windows
dir C:\Users\Admin\Downloads\reelview-final\docs\chromecast-receiver.html

# Linux/Mac
ls -la ~/reelview-final/docs/chromecast-receiver.html
```

Should exist and show:
```
-a---- 1/7/2026 12:25 PM 9492 chromecast-receiver.html
```

---

## IN ANDROID CODE

The URL is hardcoded in:
```
File: android/app/src/main/java/com/reelview/app/ChromecastPlugin.java
Method: startCast()

Code:
String receiverUrl = "https://foggygoofball.github.io/reelview-final/chromecast-receiver.html?url=" + 
    java.net.URLEncoder.encode(url, "UTF-8");
```

---

## PRODUCTION USAGE

When user clicks Cast button on Android:

1. App builds URL:
   ```
   https://foggygoofball.github.io/reelview-final/chromecast-receiver.html?url=<encoded-video-url>
   ```

2. Launches Chromecast with this URL

3. Chromecast loads the HTML from GitHub Pages

4. HTML parses the `url` parameter and plays the video

---

## GITHUB PAGES SETTINGS

To verify GitHub Pages is configured correctly:

1. Go to: https://github.com/FoggyGoofball/reelview-final
2. Click: Settings (?? icon)
3. Left sidebar: Pages
4. Verify:
   - ? Branch is set to `main`
   - ? Folder is set to `/docs`
   - ? Status shows "Your site is live at https://foggygoofball.github.io/reelview-final/"

---

## FILE STRUCTURE

```
reelview-final/
??? docs/
?   ??? index.html (optional, main page)
?   ??? chromecast-receiver.html ? (THIS ONE)
?   ??? 404.html (error page)
?   ??? chromecast-intermediary.html (older file, not used)
?   ??? .nojekyll (tells GitHub to serve raw files)
?   ??? deployment-info.json (info file)
??? android/
??? ... other folders
```

---

## QUICK TEST

Test the URL directly in your browser:

```
https://foggygoofball.github.io/reelview-final/chromecast-receiver.html
```

If it loads and shows the video player, then GitHub Pages is working correctly.

---

## FUTURE UPDATES

If you need to update the receiver HTML:

1. Edit: `/docs/chromecast-receiver.html`
2. Commit: `git add docs/chromecast-receiver.html`
3. Push: `git push origin main`
4. Wait: ~30 seconds for GitHub Pages to rebuild
5. Test: Open URL in browser to verify changes

---

## TROUBLESHOOTING

### URL Not Found (404)
- Check: File exists in `C:\Users\Admin\Downloads\reelview-final\docs\chromecast-receiver.html`
- Check: GitHub Pages is enabled (Settings ? Pages)
- Check: Source folder is `/docs`
- Solution: Push file to GitHub and wait 30 seconds

### Content Not Loading
- Check: HTML file is valid (no syntax errors)
- Check: HLS.js library loads (check Network tab in DevTools)
- Solution: Clear browser cache and reload

### Chromecast Can't Load
- Check: Chromecast and phone are on same WiFi
- Check: URL is accessible from a browser on the phone
- Check: Video URL in query parameter is correct
- Solution: Test URL in phone browser first

---

## SUMMARY

? **GitHub Pages URL:** https://foggygoofball.github.io/reelview-final/  
? **Receiver File:** chromecast-receiver.html  
? **Full URL:** https://foggygoofball.github.io/reelview-final/chromecast-receiver.html  
? **Status:** Active and serving  
? **Code:** Hardcoded in ChromecastPlugin.java  
? **Ready:** Test and deploy  

