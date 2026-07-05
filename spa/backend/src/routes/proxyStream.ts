/**
 * GET /api/proxy-stream?url=<encoded_url>&headers=<encoded_json>
 *
 * Stream proxy that fetches remote stream URLs with proper headers
 * (Referer, Origin, User-Agent) and pipes them back to the client with
 * CORS headers. This is the anti-bot bypass layer — without it, browsers
 * block direct stream URLs due to CORS, anti-hotlinking, and missing
 * Referer/Origin headers.
 *
 * Features:
 *   - Header forwarding (Referer, Origin, User-Agent from source provider)
 *   - Range request support (for MP4 seeking)
 *   - HLS manifest rewriting (rewrites relative segment URLs to proxied URLs)
 *   - Content-Type passthrough
 *   - Error handling with clean status codes
 */

import { Router, type Request, type Response } from 'express';

const router = Router();

const PROXY_PATH = '/api/proxy-stream';

/**
 * The base URL for proxy URLs. In production, this needs to be the absolute
 * URL of the Render.com backend so that HLS.js can fetch proxied segments
 * cross-origin. Set via PROXY_BASE_URL env var on the backend.
 *
 * In development (no env var), it's empty so URLs are relative and Vite
 * proxies them to localhost:3006.
 */
const PROXY_BASE_URL = process.env.PROXY_BASE_URL || '';

/**
 * Build a proxy URL for a given stream URL + headers.
 * Used by the resolution engine to wrap stream URLs before returning them.
 */
export function buildProxyUrl(
  streamUrl: string,
  headers?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  params.set('url', streamUrl);
  if (headers && Object.keys(headers).length > 0) {
    params.set('headers', JSON.stringify(headers));
  }
  return `${PROXY_BASE_URL}${PROXY_PATH}?${params.toString()}`;
}

/**
 * Build a proxy URL for a subtitle file (.vtt, .srt, .ass).
 * Uses the same /api/proxy-stream endpoint since subtitle files
 * are just text files fetched via GET.
 */
export function buildSubtitleProxyUrl(subtitleUrl: string): string {
  const params = new URLSearchParams();
  params.set('url', subtitleUrl);
  return `${PROXY_BASE_URL}${PROXY_PATH}?${params.toString()}`;
}

/**
 * Rewrite an HLS manifest so that all relative/absolute segment URLs
 * are routed through our proxy. This ensures the browser fetches
 * segments through the proxy (with proper headers) rather than
 * directly (which would fail due to CORS/anti-hotlinking).
 */
function rewriteHlsManifest(
  manifest: string,
  baseUrl: string,
  headers?: Record<string, string>,
): string {
  const lines = manifest.split('\n');
  const rewritten: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments (but process #EXT-X-KEY and #EXT-X-MAP)
    if (!trimmed) {
      rewritten.push(line);
      continue;
    }

    // Handle URI="..." attributes in tags like #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA
    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const absoluteUri = resolveUrl(originalUri, baseUrl);
        const proxiedUri = buildProxyUrl(absoluteUri, headers);
        const rewrittenLine = trimmed.replace(
          /URI="[^"]+"/,
          `URI="${proxiedUri}"`,
        );
        rewritten.push(rewrittenLine);
        continue;
      }
      rewritten.push(line);
      continue;
    }

    // Skip other comment/tag lines
    if (trimmed.startsWith('#')) {
      rewritten.push(line);
      continue;
    }

    // This is a segment URL — resolve it relative to the manifest URL
    // and wrap it through the proxy
    const absoluteUrl = resolveUrl(trimmed, baseUrl);
    rewritten.push(buildProxyUrl(absoluteUrl, headers));
  }

  return rewritten.join('\n');
}

/**
 * Resolve a possibly-relative URL against a base URL.
 */
function resolveUrl(url: string, baseUrl: string): string {
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Protocol-relative
  if (url.startsWith('//')) {
    const proto = new URL(baseUrl).protocol;
    return `${proto}${url}`;
  }

  // Absolute path
  if (url.startsWith('/')) {
    const parsed = new URL(baseUrl);
    return `${parsed.origin}${url}`;
  }

  // Relative path
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

router.get('/proxy-stream', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string | undefined;
  const headersParam = req.query.headers as string | undefined;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing "url" query parameter.' });
    return;
  }

  // Parse optional headers
  let extraHeaders: Record<string, string> = {};
  if (headersParam) {
    try {
      extraHeaders = JSON.parse(headersParam);
    } catch {
      // If headers can't be parsed, continue without them
    }
  }

  // Build the fetch headers — start with a good User-Agent, then overlay
  // any provider-specific headers (Referer, Origin, etc.)
  const fetchHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    ...extraHeaders,
  };

  // Forward Range header for seeking support
  const range = req.headers.range;
  if (range) {
    fetchHeaders['Range'] = range;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      res.status(response.status).json({
        error: `Upstream returned ${response.status}`,
      });
      return;
    }

    // ─── HLS Manifest Rewriting ──────────────────────────────────────────
    const contentType = response.headers.get('content-type') || '';
    const isHls =
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl') ||
      targetUrl.toLowerCase().includes('.m3u8');

    if (isHls) {
      const manifestText = await response.text();
      const rewritten = rewriteHlsManifest(
        manifestText,
        targetUrl,
        extraHeaders,
      );

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader(
        'Content-Type',
        'application/vnd.apple.mpegurl; charset=utf-8',
      );
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(rewritten);
      return;
    }

    // ─── Binary Stream Passthrough (MP4, MKV, TS, etc.) ──────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', '*');

    // Pass through content type
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    // Pass through content length and range support
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) {
      res.setHeader('Accept-Ranges', acceptRanges);
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    // Set status code (200 or 206 for partial content)
    const statusCode = response.status === 206 ? 206 : 200;

    // Pipe the body
    if (response.body) {
      const reader = response.body.getReader();
      res.status(statusCode);

      const pump = async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(Buffer.from(value))) {
              // Backpressure: wait for drain
              await new Promise<void>((resolve) => res.once('drain', resolve));
            }
          }
          res.end();
        } catch (err) {
          // Client disconnected or read error
          if (!res.headersSent) {
            res.status(500).json({ error: 'Stream read error' });
          } else {
            res.end();
          }
        }
      };
      pump();
    } else {
      res.status(statusCode).end();
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      res.status(504).json({ error: 'Upstream stream fetch timed out.' });
    } else {
      res.status(502).json({
        error: `Failed to fetch stream: ${err?.message || 'unknown error'}`,
      });
    }
  }
});

// Handle CORS preflight
router.options('/proxy-stream', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

export default router;
