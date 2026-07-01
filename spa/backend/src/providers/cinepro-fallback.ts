/**
 * CinePro Fallback Engine — Full Multi-Provider Waterfall
 *
 * Implements a cascading scraper inspired by cinepro-org/core's provider system.
 * This is Step 2 in the waterfall system after Consumet.
 *
 * Waterfall phases (all run in parallel within each phase):
 *   Phase 1:  VidNest (10 servers)
 *   Phase 2:  Tulnex (13 servers, 4-layer decrypt)
 *   Phase 3:  Peachify (6 servers, AES-GCM decrypt)
 *   Phase 4:  VidZee (14 servers, AES-CBC + key derive)
 *   Phase 5:  Videasy (6 servers, external decrypt)
 *   Phase 6:  Popr (10 servers, plain JSON)
 *   Phase 7:  CineSu + Icefy + VidApi (3 parallel direct APIs)
 *   Phase 8:  VidRock (encrypted ID → CDN)
 *   Phase 9:  StreamMafia (AES-256-GCM + session/token)
 *   Phase 10: AutoEmbed
 *   Phase 11: SuperEmbed + VidLink
 *   Phase 12: VidSrc (3-step HTML scraping)
 *   Phase 13: VixSrc (token-based HLS extraction)
 *
 * Anti-ban methods:
 *   - Random User-Agent rotation (Windows/Ubuntu, Chrome/Firefox)
 *   - Request timeouts (10s default, 5s for stream validation)
 *   - Stream URL validation (checks HLS/MP4 before adding)
 *   - Proxy URL unwrapping (extracts direct URLs from proxy wrappers)
 */

import { webcrypto } from 'crypto';
import { createHash, createDecipheriv } from 'crypto';
import { decryptVidNest } from './vidnest-decrypt.js';
import { decryptTulnexPayload } from './tulnex-decrypt.js';
import { decryptPeachifyPayload } from './peachify-decrypt.js';
import { deriveVidZeeKey, decryptVidZee } from './vidzee-decrypt.js';
import type {
  StreamSource,
  VidNestEncryptedResponse,
  AllMoviesResponse,
  MovieboxResponse,
  OneHDResponse,
  HollyMovieHDResponse,
  PurstreamResponse,
  TulnexApiResponse,
  TulnexExtractedStream,
  VidZeeStreamResponse,
  PeachifyApiResponse,
  PeachifyRawSource,
  VideasyDecryptedPayload,
  PoprResponse,
  CineSuResponse,
  IcefyResponse,
  VidApiResponse,
  VidrockStreams,
  VidrockCDN,
  StreamMafiaEncryptedPayload,
  StreamMafiaApiResponse,
} from './cinepro.types.js';

const subtle = webcrypto.subtle;

// ─── Shared Helpers ──────────────────────────────────────────────────────────

const COMMON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9',
};

function inferType(url: string, hint?: string): 'hls' | 'mp4' | 'mkv' {
  const u = (url || '').toLowerCase().split('?')[0];
  const h = (hint || '').toLowerCase();
  if (h.includes('hls') || h.includes('m3u8') || u.includes('.m3u8')) return 'hls';
  if (h.includes('mp4') || u.includes('.mp4')) return 'mp4';
  if (h.includes('mkv') || u.includes('.mkv')) return 'mkv';
  return 'hls';
}

function dedupeAndMerge(results: StreamSource[][]): StreamSource[] {
  const all: StreamSource[] = [];
  const seen = new Set<string>();
  for (const sources of results) {
    for (const src of sources) {
      if (src?.url && !seen.has(src.url)) {
        seen.add(src.url);
        all.push(src);
      }
    }
  }
  return all;
}


// ─── Anti-Ban: Random User-Agent (ported from cinepro src/utils/ua.ts) ──────

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomUserAgent(deviceType?: string, browserType?: string): string {
  const devices = ['android', 'windows', 'ubuntu'];
  const browsers = ['chrome', 'firefox'];

  if (!deviceType) deviceType = getRandomElement(devices);
  if (!browserType) browserType = getRandomElement(browsers);

  let browserVersion: string;
  if (browserType === 'chrome') {
    const majorVersion = Math.floor(Math.random() * (127 - 110) + 110);
    const minorVersion = Math.floor(Math.random() * 10);
    const buildVersion = Math.floor(Math.random() * (10000 - 1000) + 1000);
    const patchVersion = Math.floor(Math.random() * 100);
    browserVersion = `${majorVersion}.${minorVersion}.${buildVersion}.${patchVersion}`;
  } else {
    const firefoxVersions = Array.from({ length: 10 }, (_, i) => 90 + i);
    browserVersion = getRandomElement(firefoxVersions).toString();
  }

  if (deviceType === 'windows') {
    const windowsVersions = ['10.0', '11.0'];
    const windowsVersion = getRandomElement(windowsVersions);
    if (browserType === 'chrome') {
      return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else {
      return `Mozilla/5.0 (Windows NT ${windowsVersion}; Win64; x64; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`;
    }
  } else if (deviceType === 'ubuntu') {
    const ubuntuVersions = ['20.04', '22.04'];
    const ubuntuVersion = getRandomElement(ubuntuVersions);
    if (browserType === 'chrome') {
      return `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:94.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
    } else {
      return `Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`;
    }
  }

  return '';
}

// ─── Anti-Ban: Request timeout helper ────────────────────────────────────────

const DEFAULT_TIMEOUT = 10000; // 10 seconds

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// ─── Anti-Ban: Stream validation (ported from cinepro popr checkStreamType) ──

async function validateStreamUrl(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ isValid: boolean; type: 'hls' | 'mp4' | 'mkv' }> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { ...COMMON_HEADERS, ...headers },
      redirect: 'follow',
    }, 5000);

    if (!res.ok) return { isValid: false, type: 'mp4' };

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('video/mp4') || contentType.includes('video/webm')) {
      return { isValid: true, type: 'mp4' };
    }

    const text = await res.text();
    const trimmed = text.trim();

    if (trimmed.startsWith('#EXTM3U')) {
      const segmentLines = trimmed.split('\n').filter((l) => {
        const t = l.trim();
        return t && !t.startsWith('#');
      });
      if (segmentLines.length === 0) return { isValid: false, type: 'hls' };
      return { isValid: true, type: 'hls' };
    }

    if (trimmed.toLowerCase().includes('<!doctype html>') || trimmed.toLowerCase().includes('<html')) {
      return { isValid: false, type: 'mp4' };
    }

    return { isValid: true, type: 'mp4' };
  } catch {
    return { isValid: false, type: 'mp4' };
  }
}

// ─── Anti-Ban: Proxy URL unwrapping (ported from cinepro thirdPartyProxies.ts) ──

const PROXY_PATTERNS: RegExp[] = [
  /^https:\/\/[^/]+\.workers\.dev\/((?:https?:\/\/|https?%3A%2F%2F).+)$/,
  /^https:\/\/[^/]+\.workers\.dev\/((?:https?:\/\/)?[^/]+\/file2\/.+)$/,
  /^https:\/\/.+?\.workers\.dev\/((?:https?:\/\/).+)$/,
  /\/proxy\/(.+)$/,
  /\/(?:m3u8|mp4)-proxy\?url=(.+?)(?:&|$)/,
  /\/api\/[^/]+\/proxy\?url=(.+)$/,
  /\/proxy\?.*url=([^&]+)/,
  /\/stream\/proxy\/(.+)$/,
  /^https:\/\/[^/]+\/((?:https?:\/\/)?[a-zA-Z0-9.-]+\/file2\/.+)$/,
  /^https:\/\/[^/]+\.workers\.dev\/(?:m3u8|mp4)-proxy\?url=(.+?)(?:&|$)/,
];

function unwrapProxyUrl(url: string): string {
  for (const pattern of PROXY_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      let extracted = match[1];
      // Decode potentially multiple times for nested encoding
      try {
        let decoded = decodeURIComponent(extracted);
        // If still encoded, decode again
        if (decoded.includes('%3A%2F%2F')) {
          decoded = decodeURIComponent(decoded);
        }
        if (decoded.startsWith('http')) return decoded;
        if (!decoded.startsWith('http://') && !decoded.startsWith('https://')) {
          decoded = 'https://' + decoded;
        }
        return decoded;
      } catch {
        if (extracted.startsWith('http')) return extracted;
      }
    }
  }
  return url;
}

// ─── Anti-Ban: Random headers with rotating UA ───────────────────────────────

function getAntiBanHeaders(baseHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    ...COMMON_HEADERS,
    'User-Agent': generateRandomUserAgent(),
    ...baseHeaders,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function resolveWithCinePro(
  tmdbId: string,
  season: number,
  episode: number,
): Promise<StreamSource[]> {
  // Overall deadline: return whatever we have after 15 seconds, even if some
  // phases haven't settled yet. This prevents the frontend's 20s timeout from
  // firing and causing a silent fallback to xpass.
  const DEADLINE_MS = 15000;
  const deadline = Date.now() + DEADLINE_MS;

  // Shared accumulator — phases push into this as they resolve.
  const collected: StreamSource[] = [];
  const phasePromises: Promise<StreamSource[]>[] = [
    tryVidNestServers(tmdbId, season, episode),
    tryTulnexServers(tmdbId, season, episode),
    tryPeachifyServers(tmdbId, season, episode),
    tryVidZeeServers(tmdbId, season, episode),
    tryVideasyServers(tmdbId, season, episode),
    tryPoprServers(tmdbId, season, episode),
    trySimpleDirectAPIs(tmdbId, season, episode),
    tryVidRock(tmdbId, season, episode),
    tryStreamMafia(tmdbId, season, episode),
    tryAutoEmbed(tmdbId, season, episode),
    trySuperEmbed(tmdbId, season, episode),
    tryVidSrc(tmdbId, season, episode),
    tryVixSrc(tmdbId, season, episode),
  ];

  // Attach collectors that push results into the shared array as soon as each
  // phase resolves, so we have data available even if we hit the deadline.
  phasePromises.forEach((p) => {
    p.then((sources) => {
      if (sources && sources.length > 0) collected.push(...sources);
    }).catch(() => {
      // swallow — waterfall tolerates individual phase failures
    });
  });

  // Race between all-settled and the deadline.
  await Promise.race([
    Promise.allSettled(phasePromises),
    new Promise<void>((resolve) => setTimeout(resolve, DEADLINE_MS)),
  ]);

  // If we still have no sources after the deadline, give remaining phases a
  // short grace period (2s) in case a fast provider is about to resolve.
  if (collected.length === 0 && Date.now() < deadline + 2000) {
    await Promise.race([
      Promise.allSettled(phasePromises),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
  }

  // Unwrap proxy URLs and deduplicate
  const seen = new Set<string>();
  const deduped: StreamSource[] = [];
  for (const src of collected) {
    if (src?.url) {
      const unwrappedUrl = unwrapProxyUrl(src.url);
      if (!seen.has(unwrappedUrl)) {
        seen.add(unwrappedUrl);
        deduped.push({ ...src, url: unwrappedUrl });
      }
    }
  }

  return deduped;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: VidNest Multi-Server (existing, kept as-is)
// ═══════════════════════════════════════════════════════════════════════════════

const VIDNEST_API_BASE = 'https://new.vidnest.fun';
function getVidNestHeaders() {
  return getAntiBanHeaders({ Referer: 'https://vidnest.fun/', Origin: 'https://vidnest.fun' });
}

const VIDNEST_SERVERS = [
  'moviebox', 'allmovies', 'catflix', 'purstream', 'hollymoviehd',
  'lamda', 'flixhq', 'vidlink', 'onehd', 'klikxxi',
];

async function tryVidNestServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const promises = VIDNEST_SERVERS.map((server) => fetchVidNestServer(server, tmdbId, season, episode));
  const results = await Promise.allSettled(promises);
  return dedupeAndMerge(results.filter((r): r is PromiseFulfilledResult<StreamSource[]> => r.status === 'fulfilled').map((r) => r.value));
}

async function fetchVidNestServer(server: string, tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `${VIDNEST_API_BASE}/${server}/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: getVidNestHeaders() });
    if (!res.ok) return [];
    const json = (await res.json()) as VidNestEncryptedResponse;
    if (!json.data) return [];
    return parseVidNestResponse(server, json.data);
  } catch {
    return [];
  }
}

function parseVidNestResponse(server: string, data: string): StreamSource[] {
  try {
    switch (server) {
      case 'moviebox': {
        const parsed = decryptVidNest<MovieboxResponse>(data);
        return parsed?.url?.map((u) => ({ url: u.link, type: inferType(u.link, u.type), quality: u.resolution, headers: parsed.headers, server: 'moviebox' })) || [];
      }
      case 'onehd': {
        const parsed = decryptVidNest<OneHDResponse>(data);
        return parsed?.url ? [{ url: parsed.url, type: inferType(parsed.url), quality: 'auto', headers: parsed.headers, server: 'onehd' }] : [];
      }
      case 'hollymoviehd': {
        const parsed = decryptVidNest<HollyMovieHDResponse>(data);
        return parsed?.sources?.filter((s) => s?.file).map((s) => ({ url: s.file, type: inferType(s.file), quality: s.label || 'auto', server: 'hollymoviehd' })) || [];
      }
      case 'purstream': {
        const parsed = decryptVidNest<PurstreamResponse>(data);
        return parsed?.sources?.filter((s) => s?.url).map((s) => ({ url: s.url, type: inferType(s.url, s.format), quality: s.name || 'auto', server: 'purstream' })) || [];
      }
      case 'klikxxi': {
        const parsed = decryptVidNest<{ sources: { quality: string; type: string; url: string }[] }>(data);
        return parsed?.sources?.filter((s) => s?.url).map((s) => ({ url: s.url, type: inferType(s.url, s.type), quality: s.quality || 'auto', server: 'klikxxi' })) || [];
      }
      default: {
        // allmovies shape for catflix, lamda, flixhq, vidlink, allmovies
        const parsed = decryptVidNest<AllMoviesResponse>(data);
        return parsed?.streams?.filter((s) => s?.url).map((s) => ({ url: s.url, type: inferType(s.url, s.type), quality: 'auto', headers: s.headers, server })) || [];
      }
    }
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: Tulnex (13 servers, 4-layer decrypt)
// ═══════════════════════════════════════════════════════════════════════════════

const TULNEX_BASE = 'https://api.tulnex.com';
function getTulnexHeaders() {
  return getAntiBanHeaders({ accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'cache-control': 'no-cache' });
}

const TULNEX_SERVERS = [
  'onion', 'vidzee', 'icefy', 'tik', 'vaplayer', 'vidfast-alpha',
  'uniquestream', 'vidfast-mega', 'vidfast-vrapid', 'allmovies',
  'vidlink', 'vidfast-vedge', 'vidfast-vfast', 'moviebox',
];

async function tryTulnexServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const promises = TULNEX_SERVERS.map((server) => fetchTulnexServer(server, tmdbId, season, episode));
  const results = await Promise.allSettled(promises);
  return dedupeAndMerge(results.filter((r): r is PromiseFulfilledResult<StreamSource[]> => r.status === 'fulfilled').map((r) => r.value));
}

async function fetchTulnexServer(server: string, tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `${TULNEX_BASE}/${server}/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: { ...getTulnexHeaders(), Accept: 'application/json, */*' } });
    if (!res.ok) return [];
    const data = (await res.json()) as TulnexApiResponse;
    if (data.payload === undefined) return [];
    const decrypted = await decryptTulnexPayload(data.payload);
    if (!decrypted) return [];
    const extracted = extractTulnexUrl(decrypted);
    if (!extracted) return [];
    return [{
      url: extracted.url,
      type: extracted.url.includes('.mp4') || extracted.url.includes('.mkv') ? 'mp4' : 'hls',
      quality: 'auto',
      headers: extracted.headers || undefined,
      server: `tulnex-${server}`,
    }];
  } catch {
    return [];
  }
}

function extractTulnexUrl(data: any): TulnexExtractedStream | null {
  if (!data) return null;
  const wrap = (url: unknown, headers: Record<string, string> | null = null): TulnexExtractedStream | null => {
    if (!url || typeof url !== 'string' || !url.includes('http')) return null;
    return { url, headers };
  };
  if (typeof data === 'string' && data.includes('http')) return wrap(data);
  const d = data as Record<string, unknown>;
  const headers = (d.headers as Record<string, string>) ?? null;
  if (typeof d.url === 'string') return wrap(d.url, headers);
  if (typeof d.stream === 'string') return wrap(d.stream, headers);
  if (typeof d.playlist === 'string') return wrap(d.playlist, headers);
  if (typeof d.streamUrl === 'string') return wrap(d.streamUrl, headers);
  if (typeof d.stream_url === 'string') return wrap(d.stream_url, headers);
  if (typeof d.m3u8 === 'string') return wrap(d.m3u8, headers);
  if (Array.isArray(d.sources) && d.sources.length > 0) {
    const src = (d.sources as Record<string, unknown>[]).find((s) => typeof s.url === 'string' && (s.url as string).includes('http'));
    if (src) return wrap(src.url, (src.headers as Record<string, string>) ?? headers);
  }
  if (Array.isArray(d.streams)) {
    const src = (d.streams as Record<string, unknown>[]).find((s) => (typeof s.url === 'string' && (s.url as string).includes('http')) || (typeof s.link === 'string'));
    if (src) return wrap(src.url ?? src.link, (src.headers as Record<string, string>) ?? headers);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Peachify (6 servers, AES-GCM decrypt)
// ═══════════════════════════════════════════════════════════════════════════════

const PEACHIFY_BASE = 'https://peachify.top';
const PEACHIFY_MOVIEBOX = 'https://uwu.eat-peach.sbs';
const PEACHIFY_API = 'https://usa.eat-peach.sbs';
function getPeachifyHeaders() {
  return getAntiBanHeaders({ Referer: `${PEACHIFY_BASE}/`, Origin: PEACHIFY_BASE });
}

const PEACHIFY_SERVERS = [
  `${PEACHIFY_MOVIEBOX}/moviebox`,
  `${PEACHIFY_API}/holly`,
  `${PEACHIFY_API}/air`,
  `${PEACHIFY_API}/multi`,
  `${PEACHIFY_MOVIEBOX}/net`,
  `${PEACHIFY_MOVIEBOX}/bmb`,
];

async function tryPeachifyServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const promises = PEACHIFY_SERVERS.map((serverBase) => fetchPeachifyServer(serverBase, tmdbId, season, episode));
  const results = await Promise.allSettled(promises);
  return dedupeAndMerge(results.filter((r): r is PromiseFulfilledResult<StreamSource[]> => r.status === 'fulfilled').map((r) => r.value));
}

async function fetchPeachifyServer(serverBase: string, tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `${serverBase}/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: getPeachifyHeaders() });
    if (!res.ok) return [];
    let body = (await res.json()) as PeachifyApiResponse;
    if (body.isEncrypted && body.data) {
      const decrypted = await decryptPeachifyPayload(body.data);
      if (!decrypted) return [];
      body = decrypted;
    }
    const rawSources: any[] = Array.isArray(body.sources) ? body.sources : [];
    if (rawSources.length === 0) return [];
    const sources: StreamSource[] = [];
    for (const raw of rawSources) {
      const streamUrl = pickString(raw, ['url', 'src', 'file', 'stream', 'streamUrl', 'playbackUrl']);
      if (!streamUrl) continue;
      const rawType = pickString(raw, ['type', 'format', 'container']);
      const quality = pickString(raw, ['quality', 'resolution', 'height', 'res']);
      sources.push({
        url: streamUrl,
        type: inferType(streamUrl, rawType),
        quality: quality || 'auto',
        headers: raw.headers || raw.header || getPeachifyHeaders(),
        server: `peachify-${new URL(serverBase).hostname}`,
      });
    }
    return sources;
  } catch {
    return [];
  }
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (typeof val === 'number') return String(val);
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4: VidZee (14 servers, AES-CBC + key derive)
// ═══════════════════════════════════════════════════════════════════════════════

const VIDZEE_CORE = 'https://core.vidzee.wtf';
const VIDZEE_PLAYER = 'https://player.vidzee.wtf';
function getVidZeeHeaders() {
  return getAntiBanHeaders({ Referer: VIDZEE_PLAYER, Origin: VIDZEE_PLAYER });
}

async function tryVidZeeServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const decKey = await fetchVidZeeKey();
    if (!decKey) return [];

    const serverPromises = Array.from({ length: 14 }, (_, serverId) => fetchVidZeeServer(tmdbId, serverId, season, episode, decKey));
    const results = await Promise.allSettled(serverPromises);

    const allLinks: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        allLinks.push(...result.value);
      }
    }

    const uniqueLinks = [...new Set(allLinks)].filter((link) => link && link.startsWith('http'));
    return uniqueLinks.map((link) => ({
      url: link,
      type: inferType(link),
      quality: 'auto',
      headers: getVidZeeHeaders(),
      server: 'vidzee',
    }));
  } catch {
    return [];
  }
}

async function fetchVidZeeKey(): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${VIDZEE_CORE}/api-key`, { headers: getVidZeeHeaders() });
    if (res.status !== 200) return null;
    const data = await res.text();
    return data ? await deriveVidZeeKey(data) : null;
  } catch {
    return null;
  }
}

async function fetchVidZeeServer(tmdbId: string, serverId: number, season: number, episode: number, decKey: string): Promise<string[]> {
  try {
    const url = `${VIDZEE_PLAYER}/api/server?id=${tmdbId}&sr=${serverId}&ss=${season}&ep=${episode}`;
    const res = await fetchWithTimeout(url, { headers: getVidZeeHeaders() });
    if (!res.ok) return [];
    const response = (await res.json()) as VidZeeStreamResponse;
    if (!response?.url?.length) return [];
    const decrypted: string[] = [];
    for (const u of response.url) {
      const link = await decryptVidZee(u.link, decKey);
      if (link) decrypted.push(link);
    }
    return decrypted;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Videasy (6 servers, external decrypt via enc-dec.app)
// ═══════════════════════════════════════════════════════════════════════════════

function getVideasyHeaders() {
  return getAntiBanHeaders({ Referer: 'https://player.videasy.net/', Origin: 'https://player.videasy.net' });
}

const VIDEASY_SERVERS = [
  'https://api2.videasy.net/cuevana/sources-with-title',
  'https://api.videasy.net/mb-flix/sources-with-title',
  'https://api.videasy.net/1movies/sources-with-title',
  'https://api.videasy.net/cdn/sources-with-title',
  'https://api.videasy.net/superflix/sources-with-title',
  'https://api.videasy.net/lamovie/sources-with-title',
];

async function tryVideasyServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const promises = VIDEASY_SERVERS.map((serverUrl) => fetchVideasyServer(serverUrl, tmdbId, season, episode));
  const results = await Promise.allSettled(promises);
  return dedupeAndMerge(results.filter((r): r is PromiseFulfilledResult<StreamSource[]> => r.status === 'fulfilled').map((r) => r.value));
}

async function fetchVideasyServer(serverUrl: string, tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const params = new URLSearchParams({
      title: '',
      mediaType: 'tv',
      tmdbId: String(tmdbId),
      imdbId: '',
      episodeId: String(episode),
      seasonId: String(season),
      language: 'english',
    });
    const url = `${serverUrl}?${params}`;
    const res = await fetchWithTimeout(url, { headers: getVideasyHeaders() });
    if (!res.ok) return [];
    const blob = await res.text();
    if (!blob || blob.length < 10) return [];
    const decrypted = await decryptVideasyBlob(blob, String(tmdbId));
    if (!decrypted || decrypted.sources.length === 0) return [];
    return decrypted.sources.filter((s) => s?.url).map((s) => ({
      url: s.url,
      type: inferType(s.url, s.type),
      quality: s.quality || 'unknown',
      headers: getVideasyHeaders(),
      server: `videasy-${new URL(serverUrl).pathname.split('/')[1]}`,
    }));
  } catch {
    return [];
  }
}

async function decryptVideasyBlob(blob: string, tmdbId: string): Promise<VideasyDecryptedPayload | null> {
  try {
    const res = await fetch('https://enc-dec.app/api/dec-videasy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: blob, id: tmdbId }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { status: number; result: { sources: { url: string; quality?: string; type?: string }[]; subtitles?: any[] } };
    if (json.status !== 200 || !json.result?.sources) return null;
    return { sources: json.result.sources, subtitles: json.result.subtitles };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: Popr (10 servers, plain JSON)
// ═══════════════════════════════════════════════════════════════════════════════

const POPR_BASE = 'https://popr.ink';
function getPoprHeaders() {
  return getAntiBanHeaders({ Referer: `${POPR_BASE}/` });
}

const POPR_SERVERS = [
  'default', 'catflix', 'hexa', 'Gama', 'Liligoon',
  'Sigma', 'Prime', 'Alfa', 'Lamda', 'ynx_vidsrc',
];

async function tryPoprServers(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const promises = POPR_SERVERS.map((server) => fetchPoprServer(server, tmdbId, season, episode));
  const results = await Promise.allSettled(promises);
  return dedupeAndMerge(results.filter((r): r is PromiseFulfilledResult<StreamSource[]> => r.status === 'fulfilled').map((r) => r.value));
}

async function fetchPoprServer(server: string, tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `${POPR_BASE}/api/vidnest?id=${tmdbId}&type=tv&server=${server}&season=${season}&episode=${episode}`;
    const res = await fetchWithTimeout(url, { headers: getPoprHeaders() });
    if (res.status !== 200) return [];
    const data = (await res.json()) as PoprResponse;
    const stream = data?.results?.[0]?.streams?.[0];
    if (!stream?.url) return [];
    return [{
      url: stream.url,
      type: inferType(stream.url),
      quality: stream.quality || 'auto',
      headers: { ...getPoprHeaders(), ...(stream.headers || {}) },
      server: `popr-${server}`,
    }];
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 7: CineSu + Icefy + VidApi (3 parallel direct APIs)
// ═══════════════════════════════════════════════════════════════════════════════

async function trySimpleDirectAPIs(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const [cineSu, icefy, vidApi] = await Promise.allSettled([
    tryCineSu(tmdbId, season, episode),
    tryIcefy(tmdbId, season, episode),
    tryVidApi(tmdbId, season, episode),
  ]);
  const results: StreamSource[][] = [];
  if (cineSu.status === 'fulfilled') results.push(cineSu.value);
  if (icefy.status === 'fulfilled') results.push(icefy.value);
  if (vidApi.status === 'fulfilled') results.push(vidApi.value);
  return dedupeAndMerge(results);
}

async function tryCineSu(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `https://cine.su/v1/stream/master/tv/${tmdbId}/${season}/${episode}.m3u8`;
    const res = await fetchWithTimeout(url, { method: 'HEAD', headers: getAntiBanHeaders() });
    if (res.status !== 200) return [];
    return [{ url, type: 'hls', quality: '1080', server: 'cinesu' }];
  } catch {
    return [];
  }
}

async function tryIcefy(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `https://streams.icefy.top/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: getAntiBanHeaders({ Referer: 'https://streams.icefy.top', Origin: 'https://streams.icefy.top' }) });
    if (!res.ok) return [];
    const data = (await res.json()) as IcefyResponse;
    if (!data?.stream) return [];
    return [{ url: data.stream, type: 'hls', quality: '1080', server: 'icefy' }];
  } catch {
    return [];
  }
}

async function tryVidApi(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const apiUrl = new URL('https://streamdata.vaplayer.ru/api.php');
    apiUrl.searchParams.set('tmdb', tmdbId);
    apiUrl.searchParams.set('type', 'tv');
    apiUrl.searchParams.set('season', String(season));
    apiUrl.searchParams.set('episode', String(episode));
    const res = await fetchWithTimeout(apiUrl.toString(), {
      headers: getAntiBanHeaders({ Referer: 'https://brightpathsignals.com/', Origin: 'https://brightpathsignals.com' }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as VidApiResponse;
    if (json.status_code !== '200' || !json.data?.stream_urls) return [];
    return json.data.stream_urls.map((streamUrl) => ({
      url: streamUrl,
      type: inferType(streamUrl),
      quality: 'auto',
      server: 'vidapi',
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 8: VidRock (encrypted ID → CDN resolution)
// ═══════════════════════════════════════════════════════════════════════════════

const VIDROCK_BASE = 'https://vidrock.net/';
function getVidRockHeaders() {
  return getAntiBanHeaders({ Referer: VIDROCK_BASE, Origin: VIDROCK_BASE });
}

const VIDROCK_PASSPHRASE = 'x7k9mPqT2rWvY8zA5bC3nF6hJ2lK4mN9';

async function tryVidRock(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const itemId = `${tmdbId}_${season}_${episode}`;
    const encrypted = await encryptVidRockId(itemId);
    const url = `${VIDROCK_BASE}api/tv/${encrypted}`;
    const res = await fetchWithTimeout(url, { headers: { ...getVidRockHeaders(), Referer: VIDROCK_BASE } });
    if (res.status !== 200) return [];
    const data = (await res.json()) as VidrockStreams;
    const sources: StreamSource[] = [];
    for (const [, stream] of Object.entries(data)) {
      if (!stream?.url) continue;
      if (stream.url.includes('hls2.vdrk.site')) {
        // Two-step: fetch CDN list
        try {
          const cdnRes = await fetchWithTimeout(stream.url, { headers: getVidRockHeaders() });
          if (!cdnRes.ok) continue;
          const cdnData = (await cdnRes.json()) as VidrockCDN[];
          for (const obj of cdnData) {
            let finalUrl = obj.url;
            if (finalUrl.startsWith('https://proxy.vidrock.store/')) {
              finalUrl = decodeURIComponent(finalUrl.slice('https://proxy.vidrock.store/'.length).replace(/^\//, ''));
            }
            sources.push({
              url: finalUrl,
              type: inferType(finalUrl),
              quality: `${obj.resolution}p`,
              server: 'vidrock-cdn',
            });
          }
        } catch { /* ignore */ }
      } else {
        sources.push({
          url: stream.url,
          type: 'hls',
          quality: '1080',
          server: 'vidrock',
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

async function encryptVidRockId(itemId: string): Promise<string> {
  const textEncoder = new TextEncoder();
  const keyData = textEncoder.encode(VIDROCK_PASSPHRASE);
  const iv = textEncoder.encode(VIDROCK_PASSPHRASE.substring(0, 16));
  const key = await subtle.importKey('raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']);
  const encrypted = await subtle.encrypt({ name: 'AES-CBC', iv }, key, textEncoder.encode(itemId));
  const base64 = Buffer.from(new Uint8Array(encrypted)).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 9: StreamMafia (AES-256-GCM + session cookie + token)
// ═══════════════════════════════════════════════════════════════════════════════

const STREAMMAFIA_BASE = 'https://player.nhdapi.com';
function getStreamMafiaHeaders() {
  return getAntiBanHeaders({ Referer: `${STREAMMAFIA_BASE}/`, Origin: STREAMMAFIA_BASE });
}

async function tryStreamMafia(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const headers = { ...getStreamMafiaHeaders(), 'x-content-id': tmdbId };

    // Step 1: Get session cookie
    const sessionRes = await fetchWithTimeout(`${STREAMMAFIA_BASE}/api/session`, { method: 'POST', headers });
    const cookie = sessionRes.headers.get('Set-Cookie') || '';
    (headers as any).Cookie = cookie.split(';')[0] || '';

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 2: Get token
    const tokenRes = await fetchWithTimeout(`${STREAMMAFIA_BASE}/api/token`, { headers });
    if (tokenRes.status !== 200) return [];
    const tokenData = (await tokenRes.json()) as { token?: string };
    if (!tokenData.token) return [];
    (headers as any)['x-api-token'] = tokenData.token;

    // Step 3: Fetch encrypted stream data
    const url = `${STREAMMAFIA_BASE}/api/?tv=${tmdbId}&season=${season}&episode=${episode}`;
    const streamRes = await fetchWithTimeout(url, { headers });
    if (streamRes.status !== 200) return [];
    const encrypted = (await streamRes.json()) as StreamMafiaEncryptedPayload;
    if (!encrypted) return [];

    const decrypted = decryptStreamMafia(encrypted);
    if (!decrypted?.stream?.hls_streaming) return [];

    const sources: StreamSource[] = [{
      url: decrypted.stream.hls_streaming,
      type: 'hls',
      quality: 'auto',
      server: 'streammafia',
    }];

    // Also add download links
    for (const download of decrypted.stream.download || []) {
      if (download?.url) {
        sources.push({
          url: download.url,
          type: inferType(download.url),
          quality: download.quality || 'auto',
          server: 'streammafia-dl',
        });
      }
    }

    return sources;
  } catch {
    return [];
  }
}

function decryptStreamMafia(payload: StreamMafiaEncryptedPayload): StreamMafiaApiResponse | null {
  try {
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const key = createHash('sha256').update('Z9#rL!v2K*5qP&7mXw').digest();
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 10: AutoEmbed Direct Query (existing)
// ═══════════════════════════════════════════════════════════════════════════════

async function tryAutoEmbed(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const url = `https://autoembed.cc/api/v2/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: getAntiBanHeaders({ Accept: 'application/json' }) });
    if (!res.ok) return [];
    const json = await res.json();
    const sources: StreamSource[] = [];
    if (Array.isArray(json.sources)) {
      for (const s of json.sources) {
        if (s?.url) {
          sources.push({
            url: s.url,
            type: inferType(s.url, s.type),
            quality: s.quality || 'auto',
            server: 'autoembed',
          });
        }
      }
    }
    return sources;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 11: SuperEmbed / VidLink Direct (existing)
// ═══════════════════════════════════════════════════════════════════════════════

async function trySuperEmbed(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  const sources: StreamSource[] = [];

  // VidLink API
  try {
    const url = `https://vidlink.pro/api/tv/${tmdbId}/${season}/${episode}`;
    const res = await fetchWithTimeout(url, { headers: getAntiBanHeaders({ Accept: 'application/json', Referer: 'https://vidlink.pro/' }) });
    if (res.ok) {
      const json = await res.json();
      if (json?.url) {
        sources.push({ url: json.url, type: inferType(json.url), quality: 'auto', server: 'vidlink' });
      }
    }
  } catch { /* ignore */ }

  // SuperEmbed API
  try {
    const url = `https://multiembed.mov/directstream.php?video_id=${tmdbId}&s=${season}&e=${episode}`;
    const res = await fetchWithTimeout(url, { headers: getAntiBanHeaders({ Accept: 'application/json', Referer: 'https://multiembed.mov/' }) });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.sources)) {
        for (const s of json.sources) {
          if (s?.file) {
            sources.push({ url: s.file, type: inferType(s.file), quality: s.label || 'auto', server: 'superembed' });
          }
        }
      }
    }
  } catch { /* ignore */ }

  return sources;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 12: VidSrc 3-step HTML scraping (ported from cinepro vidsrc provider)
// ═══════════════════════════════════════════════════════════════════════════════

const VIDSRC_BASE = 'https://vsembed.ru/';

async function tryVidSrc(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const headers = getAntiBanHeaders({ Referer: VIDSRC_BASE });
    const pageUrl = `${VIDSRC_BASE}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`;

    // Step 1: Fetch embed page
    const html = await fetchHtml(pageUrl, headers);
    if (!html) return [];

    // Step 2: Extract iframe src
    const iframeMatch = html.match(/<iframe[^>]*\s+src=["']([^"']+)["'][^>]*>/i);
    if (!iframeMatch || !iframeMatch[1]) return [];
    let secondUrl = iframeMatch[1];
    if (secondUrl.startsWith('//')) secondUrl = 'https:' + secondUrl;

    // Step 3: Fetch second page
    const secondHtml = await fetchHtml(secondUrl, headers);
    if (!secondHtml) return [];

    // Step 4: Extract third URL from inline JS
    const relSrc = secondHtml.match(/src:\s*['"]([^'"]+)['"]/i)?.[1];
    if (!relSrc) return [];
    let thirdUrl: string;
    try {
      thirdUrl = new URL(relSrc, secondUrl).href;
    } catch {
      return [];
    }

    // Step 5: Fetch third page and extract m3u8 URLs
    const thirdHtml = await fetchHtml(thirdUrl, headers);
    if (!thirdHtml) return [];

    const m3u8Urls = extractVidSrcM3u8(thirdHtml);
    if (!m3u8Urls || m3u8Urls.length === 0) return [];

    return m3u8Urls.map((url) => ({
      url,
      type: 'hls' as const,
      quality: 'auto',
      headers: { ...headers, Referer: 'https://cloudnestra.com/', Origin: 'https://cloudnestra.com' },
      server: 'vidsrc',
    }));
  } catch {
    return [];
  }
}

async function fetchHtml(url: string, headers: Record<string, string>): Promise<string | null> {
  try {
    if (url.startsWith('//')) url = 'https:' + url;
    const res = await fetchWithTimeout(url, { headers });
    if (res.status !== 200) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractVidSrcM3u8(html: string): string[] | null {
  const fileField = html.match(/file\s*:\s*["']([^"']+)["']/i)?.[1];
  if (!fileField) return null;

  const playerDomains = new Map<string, string>();
  playerDomains.set('{v1}', 'neonhorizonworkshops.com');
  playerDomains.set('{v2}', 'wanderlynest.com');
  playerDomains.set('{v3}', 'orchidpixelgardens.com');
  playerDomains.set('{v4}', 'cloudnestra.com');

  const rawUrls = fileField.split(/\s+or\s+/i);
  const m3u8Urls = rawUrls.map((template) => {
    let url = template;
    for (const [placeholder, domain] of playerDomains.entries()) {
      url = url.replace(placeholder, domain);
    }
    if (url.includes('{') || url.includes('}')) return null;
    return url;
  }).filter((url): url is string => url !== null);

  return m3u8Urls.length > 0 ? m3u8Urls : null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 13: VixSrc token-based extraction (ported from cinepro vixsrc provider)
// ═══════════════════════════════════════════════════════════════════════════════

const VIXSRC_BASE = 'https://vixsrc.to';

async function tryVixSrc(tmdbId: string, season: number, episode: number): Promise<StreamSource[]> {
  try {
    const headers = getAntiBanHeaders({ Referer: VIXSRC_BASE, Origin: VIXSRC_BASE });

    // Step 1: Fetch API to get embed page URL
    const apiUrl = `${VIXSRC_BASE}/api/tv/${tmdbId}/${season}/${episode}`;
    const apiRes = await fetchWithTimeout(apiUrl, { headers });
    if (apiRes.status !== 200) return [];
    const apiData = (await apiRes.json()) as { src: string };
    if (!apiData?.src) return [];

    // Step 2: Fetch embed page HTML
    const embedRes = await fetchWithTimeout(`${VIXSRC_BASE}${apiData.src}`, { headers });
    if (embedRes.status !== 200) return [];
    const html = await embedRes.text();

    // Step 3: Extract token, expires, and playlist URL from HTML
    const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1];
    const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1];
    const playlist = html.match(/url\s*:\s*["']([^"']+)/)?.[1];

    if (!token || !expires || !playlist) return [];

    // Check if token is expired
    if (parseInt(expires, 10) * 1000 - 60000 < Date.now()) return [];

    // Step 4: Build master playlist URL with token
    const separator = playlist.includes('?') ? '&' : '?';
    const masterUrl = `${playlist}${separator}token=${token}&expires=${expires}&h=1`;

    // Step 5: Fetch playlist content
    const playlistRes = await fetchWithTimeout(masterUrl, { headers: { ...headers, Referer: apiUrl } });
    if (playlistRes.status !== 200) return [];
    const playlistContent = await playlistRes.text();

    // Step 6: Parse variants for best quality
    const variants = parseHLSVariants(playlistContent);
    if (variants.length === 0) return [];

    const bestVariant = variants.reduce((best, current) =>
      current.resolution > best.resolution ? current : best
    );

    return [{
      url: masterUrl,
      type: 'hls',
      quality: `${bestVariant.resolution}p`,
      headers: { ...headers, Referer: apiUrl },
      server: 'vixsrc',
    }];
  } catch {
    return [];
  }
}

function parseHLSVariants(content: string): Array<{ resolution: number; url: string }> {
  const variants: Array<{ resolution: number; url: string }> = [];
  const regex = /#EXT-X-STREAM-INF:[^\n]*RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    variants.push({ resolution: parseInt(match[1], 10), url: match[2] });
  }
  return variants;
}
