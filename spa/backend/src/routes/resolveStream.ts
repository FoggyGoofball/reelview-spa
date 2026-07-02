/**
 * POST /api/resolve-stream
 *
 * The core waterfall resolution endpoint.
 *   Step 1: Try @consumet/extensions (FlixHQ → ViewVault)
 *   Step 2: Fallback to CinePro engine (VidNest → AutoEmbed → SuperEmbed)
 *   Step 3: Return clean error if both fail
 *
 * Caching: 24-hour TTL, key = `${tmdbId}_${season}_${episode}`
 *
 * Request body: { tmdbId, type: "tv", season, episode, title? }
 *   - title (optional): The show title, used for Consumet search (if omitted, Consumet step will likely fail for TV)
 */

import { Router, type Request, type Response } from 'express';
import { getCacheKey, getFromCache, setInCache } from '../cache.js';
import { resolveWithConsumet } from '../providers/consumet-wrapper.js';
import { resolveWithCinePro } from '../providers/cinepro-fallback.js';
import { buildProxyUrl } from './proxyStream.js';
import type {
  ResolveStreamRequest,
  ResolveStreamResponse,
  StreamSource,
} from '../providers/cinepro.types.js';

const router = Router();

router.post('/resolve-stream', async (req: Request, res: Response) => {
  const { tmdbId, type, season, episode, title } = req.body as ResolveStreamRequest & { title?: string };

  // ─── Validation ─────────────────────────────────────────────────────────
  if (!tmdbId || typeof tmdbId !== 'string') {
    const response: ResolveStreamResponse = {
      success: false,
      error: 'Missing or invalid "tmdbId" (must be a string).',
    };
    res.status(400).json(response);
    return;
  }

  // For TV shows, season and episode are required
  if (type === 'tv' && (season == null || episode == null)) {
    const response: ResolveStreamResponse = {
      success: false,
      error: 'For "tv" type, both "season" and "episode" are required.',
    };
    res.status(400).json(response);
    return;
  }

  const s = Number(season) || 1;
  const e = Number(episode) || 1;
  const showTitle = title || '';

  // ─── Cache Check ─────────────────────────────────────────────────────────
  const cacheKey = getCacheKey(tmdbId, s, e);
  const cached = getFromCache<ResolveStreamResponse>(cacheKey);
  if (cached) {
    cached.fromCache = true;
    const srcCount = cached.sources?.length ?? 0;
    console.log(
      `[ResolveStream] CACHE HIT  tmdbId=${tmdbId}  S=${s}  E=${e}  sources=${srcCount}  provider=${cached.provider ?? '?'}`,
    );
    res.json(cached);
    return;
  }
  console.log(
    `[ResolveStream] CACHE MISS  tmdbId=${tmdbId}  S=${s}  E=${e}  title="${showTitle}" — starting waterfall`,
  );

  // ─── Waterfall Resolution ────────────────────────────────────────────────
  let sources: StreamSource[] = [];

  // Helper: race a promise against a timeout so no single step can hang the
  // entire request. Returns [] on timeout.
  const withTimeout = <T>(p: Promise<T[]>, ms: number): Promise<T[]> =>
    Promise.race([
      p,
      new Promise<T[]>((resolve) => setTimeout(() => resolve([]), ms)),
    ]);

  if (showTitle) {
    // Step 1: Consumet — only works if we have a title to search by.
    // Give it at most 12s so we still have time for the CinePro fallback.
    sources = await withTimeout(resolveWithConsumet(showTitle, tmdbId, s, e), 12000);
  }

  let providerUsed = 'consumet';
  if (sources.length === 0) {
    // Step 2: CinePro fallback (works with TMDB IDs directly).
    // resolveWithCinePro has its own internal 15s deadline.
    sources = await withTimeout(resolveWithCinePro(tmdbId, s, e), 18000);
    providerUsed = 'cinepro';
  }

  // ─── Response ────────────────────────────────────────────────────────────
  if (sources.length > 0) {
    // Wrap each stream URL through our proxy endpoint so the browser can
    // fetch it with proper headers (Referer, Origin, User-Agent) and CORS.
    // Without this, direct stream URLs fail due to anti-hotlinking and CORS.
    const proxiedSources: StreamSource[] = sources.map((s) => ({
      ...s,
      url: buildProxyUrl(s.url, s.headers),
    }));

    const response: ResolveStreamResponse = {
      success: true,
      sources: proxiedSources,
      provider: providerUsed,
      fromCache: false,
    };

    // Cache the successful result for 24 hours
    setInCache(cacheKey, response);

    // Frontend expects: { success, data: { sources: [...] }, error? }
    // So we wrap in "data" as well for compatibility
    res.json({
      success: true,
      data: { sources: proxiedSources },
      fromCache: false,
      provider: providerUsed,
      sources: proxiedSources, // keep top-level for backward compat
    } as any);
  } else {
    res.json({
      success: false,
      error: 'No stream sources could be resolved from any provider. The episode may not be available.',
    });
  }
});

export default router;


