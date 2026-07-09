/**
 * GET /api/embed-player?url=<encoded_stream_url>&type=<hls|mp4>
 *
 * Serves a minimal HTML page with a <video> element that loads the given
 * stream URL. This page is loaded in an iframe by the SPA, bypassing CORS
 * restrictions that would block direct <video> playback from GitHub Pages.
 *
 * The stream URL is expected to be a proxied URL (via /api/proxy-stream)
 * or any URL that sets `Access-Control-Allow-Origin: *`.
 *
 * Query params:
 *   url   - The stream URL (required, should be URL-encoded)
 *   type  - "hls" or "mp4" (optional, auto-detected from URL if absent)
 */

import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/embed-player", (req: Request, res: Response) => {
  const streamUrl = req.query.url as string | undefined;
  if (!streamUrl) {
    res.status(400).send("<h1>Missing 'url' query parameter</h1>");
    return;
  }

  const decodedUrl = decodeURIComponent(streamUrl);
  const isHls =
    (req.query.type as string) === "hls" ||
    decodedUrl.includes(".m3u8") ||
    decodedUrl.includes("proxy-stream");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stream Player</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }
  .loading {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #888;
    font-family: sans-serif;
    font-size: 14px;
  }
</style>
</head>
<body>
<div class="loading" id="loading">Loading stream...</div>
<video id="player" controls autoplay playsinline></video>
<script>
${isHls ? `
// HLS playback via hls.js or native
(function() {
  var video = document.getElementById('player');
  var loading = document.getElementById('loading');
  var url = ${JSON.stringify(decodedUrl)};

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    video.src = url;
    loading.style.display = 'none';
  } else {
    // Load hls.js dynamically
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = function() {
      if (Hls.isSupported()) {
        var hls = new Hls({
          enableWorker: true,
          maxBufferLength: 30,
          startLevel: -1
        });
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
          loading.style.display = 'none';
          video.play().catch(function(){});
        });
        hls.on(Hls.Events.ERROR, function(event, data) {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            }
          }
        });
      } else {
        loading.textContent = 'HLS not supported in this browser';
      }
    };
    script.onerror = function() {
      loading.textContent = 'Failed to load HLS player';
    };
    document.head.appendChild(script);
  }
})();
` : `
// Direct MP4 playback
(function() {
  var video = document.getElementById('player');
  var loading = document.getElementById('loading');
  video.src = ${JSON.stringify(decodedUrl)};
  video.oncanplay = function() { loading.style.display = 'none'; };
  video.onerror = function() { loading.textContent = 'Failed to load video'; };
})();
`}
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(html);
});

export default router;
