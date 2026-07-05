# INTERMEDIARY PAGE HOSTING - QUICK REFERENCE
## One-Minute Summary

---

## THE ANSWER IN 30 SECONDS

The intermediary Chromecast receiver page is **hosted by an embedded Java HTTP server running inside the Android app itself** on `localhost:8888`.

**That's it.** No external hosting, no network calls, no servers on the internet. Just an `HttpServer` instance listening on the local device.

---

## FIVE-MINUTE EXPLANATION

### What is the intermediary page?
It's the HTML/JavaScript that runs on the Chromecast device when you cast. It displays a video player and loads video from the proxy.

### Where is it hosted?
**Inside the Android app**, on an embedded HTTP server.

### How does it work?

1. **App starts HTTP server on localhost:8888**
   ```java
   HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8888), 0);
   server.start();
   ```

2. **Server registers /receiver endpoint**
   ```java
   server.createContext("/receiver", new ReceiverHandler());
   ```

3. **User clicks Cast button**
   - App builds URL: `http://127.0.0.1:8888/receiver?url=<video-url>`
   - Launches Chromecast with this URL

4. **Chromecast connects to /receiver**
   - Receives HTML page
   - HTML loads video from `/cast` endpoint
   - Proxy adds headers to video requests

5. **Video plays on Chromecast with authentication ?**

### What makes it special?
- **No external hosting needed** - Server is part of the app
- **No internet calls** - All localhost
- **Secure** - Only accessible from the local device
- **Efficient** - Streams video directly (no buffering)
- **Automatic** - Starts/stops with app

---

## KEY FILES

| File | Location | Purpose |
|------|----------|---------|
| **CastProxyServer.java** | `android/app/src/main/java/com/reelview/app/` | The HTTP server itself |
| **ReceiverHandler** | Lines 188-212 in CastProxyServer | Serves the HTML page |
| **CastHandler** | Lines 152-187 in CastProxyServer | Proxies video with headers |
| **getCastReceiverHtml()** | Lines 475-550 in CastProxyServer | The embedded HTML code |

---

## THREE ENDPOINTS

```
1. GET /receiver?url=...
   ? Returns HTML
   Chromecast loads this HTML page

2. GET /cast?url=...
   ? Proxies video with headers
   HTML's video player loads video from here

3. GET /health
   ? Returns server status (JSON)
   For debugging/monitoring
```

---

## THE EMBEDDED HTML

The HTML is **embedded as a Java String** (not loaded from disk or network).

```javascript
// Inside getCastReceiverHtml() method
return "<!DOCTYPE html>\n" +
    "<html>\n" +
    "  <head>\n" +
    "    <title>ReelView Chromecast Receiver</title>\n" +
    "    <style>... fullscreen video player styling ...</style>\n" +
    "  </head>\n" +
    "  <body>\n" +
    "    <video id=\"video\" controls autoplay></video>\n" +
    "    <script>\n" +
    "      // Parse URL from query string\n" +
    "      const videoUrl = params.get('url');\n" +
    "      // Load from proxy\n" +
    "      video.src = 'http://localhost:8888/cast?url=' + videoUrl;\n" +
    "    </script>\n" +
    "  </body>\n" +
    "</html>";
```

**Result:** No external files to manage, everything self-contained.

---

## PORTS

- **Primary:** 8888
- **Fallback:** 8889, 8890, 8891 (if 8888 is in use)
- **Binding:** 127.0.0.1 (localhost only, secure)

---

## LIFECYCLE

```
App starts
  ?
CastProxyServer instance created
  ?
User clicks Cast button
  ?
CastProxyServer.start() called
  ?
HttpServer starts listening on 127.0.0.1:8888
  ?
Chromecast connects
  ?
Server handles requests
  ?
App closes
  ?
CastProxyServer.stop() called
  ?
Server shuts down
```

---

## EXAMPLE REQUEST/RESPONSE

### Step 1: Get Receiver HTML
```
? GET http://127.0.0.1:8888/receiver?url=https%3A%2F%2Fexample.com%2Fvideo.m3u8
? HTTP 200 OK
? Content-Type: text/html
? [HTML page with video player]
```

### Step 2: Load Video from Proxy
```
? GET http://127.0.0.1:8888/cast?url=https%3A%2F%2Fexample.com%2Fvideo.m3u8
? HTTP 200 OK
? Authorization: Bearer token (added by proxy)
? Content-Type: video/mp2t
? [Video data stream]
```

---

## WHY THIS APPROACH?

| Reason | Benefit |
|--------|---------|
| **Embedded server** | No dependencies or external services |
| **Localhost** | Secure, only accessible from device |
| **Self-contained HTML** | No files to manage, no network calls |
| **Streaming** | Memory efficient, handles large files |
| **Header injection** | Adds authentication headers automatically |
| **Port fallback** | Works even if 8888 is in use |

---

## THE MAGIC PART

**Without the proxy:**
```
Chromecast ? Video Server
GET /video.m3u8
? No Authorization header
? HTTP 403 Forbidden
? Video won't play
```

**With the proxy:**
```
Chromecast ? App Server ? Video Server
GET /video.m3u8
? Authorization header (added by proxy)
? HTTP 200 OK
? Video plays!
```

---

## SUMMARY TABLE

| Aspect | Details |
|--------|---------|
| **What** | HTML receiver page for Chromecast |
| **Where** | Inside Android app (localhost:8888) |
| **How** | Java HttpServer with embedded HTML |
| **Why** | Inject auth headers, stream securely |
| **Port** | 8888 (+ fallback 8889-8891) |
| **Endpoints** | /receiver (HTML), /cast (proxy), /health (check) |
| **HTML** | Embedded as Java String (~400 lines) |
| **Streaming** | Chunks (8KB), no buffering |
| **Headers** | Applied from ReelViewWebViewClient |
| **Startup** | When user clicks Cast |
| **Shutdown** | When app closes |

---

## QUICK ANSWERS

**Q: Is there a separate server running?**  
A: No, it's part of the Android app using Java's built-in `HttpServer` class.

**Q: How does Chromecast access localhost?**  
A: Chromecast is on the same WiFi network as the phone. Both use 127.0.0.1 to mean "this device."

**Q: Can anyone access the server?**  
A: Only from the same device. Binding to 127.0.0.1 makes it secure.

**Q: What if port 8888 is busy?**  
A: Server automatically tries 8889, 8890, 8891 (fallback ports).

**Q: Is the HTML hardcoded?**  
A: Yes, it's a Java String in `getCastReceiverHtml()` method. ~400 lines of HTML/CSS/JS.

**Q: How does authentication work?**  
A: Proxy gets headers stored by `ReelViewWebViewClient` and applies them to upstream requests.

**Q: Why not use Google Cast Framework?**  
A: This simpler approach works for basic video playback without extra dependencies.

**Q: Can it handle large files?**  
A: Yes, streaming in 8KB chunks prevents memory issues.

---

## DEVELOPER NOTES

### Key Methods:

1. **CastProxyServer.getInstance(context)**
   - Singleton accessor
   - Gets or creates the server

2. **CastProxyServer.start()**
   - Starts HTTP server
   - Tries ports 8888-8891
   - Sets `running = true`

3. **CastProxyServer.stop()**
   - Shuts down server
   - Cleans up resources

4. **ReceiverHandler.handle()**
   - Serves `/receiver` endpoint
   - Returns HTML

5. **CastHandler.handle()**
   - Serves `/cast` endpoint
   - Proxies video with headers

6. **getCastReceiverHtml()**
   - Returns embedded HTML string
   - ~400 lines of HTML/CSS/JS

### Header Application:

```java
// Get headers for URL
Map<String, String> headers = ReelViewWebViewClient.getHeaders(videoUrl);

// Apply to upstream connection
if (headers != null && !headers.isEmpty()) {
    for (Map.Entry<String, String> entry : headers.entrySet()) {
        connection.setRequestProperty(entry.getKey(), entry.getValue());
    }
}
```

---

## FINAL ANSWER

The intermediary page is **hosted by an embedded HTTP server inside the Android app on localhost:8888**, serving HTML that loads video from a `/cast` endpoint which proxies video with authentication headers applied automatically.

**No external hosting. No network calls. Completely self-contained.** ?

