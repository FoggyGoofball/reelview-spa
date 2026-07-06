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
import { resolveWithOpenSubtitles } from '../providers/opensubtitles-fallback.js';
import { buildProxyUrl } from './proxyStream.js';
import type {
  ResolveStreamRequest,
  ResolveStreamResponse,
  StreamSource,
  SubtitleTrack,
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

  // ─── Parallel Resolution (both providers run simultaneously) ────────────
  // Previously Consumet ran first and CinePro was skipped if Consumet found
  // anything. Now both run in parallel so we get ALL available links — Consumet
  // provides VidLink/ViewVault links, CinePro provides ~62+ server endpoints.
  //
  // Each provider has its own internal timeout:
  //   Consumet: 12s
  //   CinePro:  15s (overall deadline across all 13 phases)

  // Helper: race a promise against a timeout so no single step can hang the
  // entire request. Returns empty result on timeout.
  const withStreamTimeout = (p: Promise<StreamSource[]>, ms: number): Promise<StreamSource[]> =>
    Promise.race([
      p,
      new Promise<StreamSource[]>((resolve) => setTimeout(() => resolve([]), ms)),
    ]);

  // CinePro now returns { sources, subtitles }, so we need a special race
  const withCineProTimeout = (
    p: Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }>,
    ms: number,
  ): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> =>
    Promise.race([
      p,
      new Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }>((resolve) =>
        setTimeout(() => resolve({ sources: [], subtitles: [] }), ms),
      ),
    ]);

  const cineproResult = await withCineProTimeout(resolveWithCinePro(tmdbId, s, e), 18000);
  const consumetSources = showTitle
    ? await withStreamTimeout(resolveWithConsumet(showTitle, tmdbId, s, e), 12000)
    : ([] as StreamSource[]);

  // Merge and deduplicate — prefer CinePro URLs (more reliable) but keep both
  const seen = new Set<string>();
  const merged: StreamSource[] = [];
  for (const src of [...cineproResult.sources, ...consumetSources]) {
    if (src?.url && !seen.has(src.url)) {
      seen.add(src.url);
      merged.push(src);
    }
  }

  const sources = merged;
  const providerUsed = consumetSources.length > 0 && cineproResult.sources.length > 0
    ? 'consumet+cinepro'
    : cineproResult.sources.length > 0
      ? 'cinepro'
      : 'consumet';

  // Collect subtitles — try CinePro subtitles first, then OpenSubtitles as fallback
  let subtitles: SubtitleTrack[] = [...cineproResult.subtitles];

  // If CinePro didn't find subtitles, try OpenSubtitles (uses OPENSUBTITLES_API_KEY env var)
  if (subtitles.length === 0 && sources.length > 0) {
    const osApiKey = process.env.OPENSUBTITLES_API_KEY || '';
    if (osApiKey) {
      const osSubtitles = await resolveWithOpenSubtitles(osApiKey, tmdbId, s, e);
      if (osSubtitles.length > 0) {
        console.log(`[ResolveStream] OpenSubtitles returned ${osSubtitles.length} tracks for tmdbId=${tmdbId} S=${s} E=${e}`);
        subtitles = osSubtitles;
      }
    }
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
      subtitles: subtitles.length > 0 ? subtitles : undefined,
      provider: providerUsed,
      fromCache: false,
    };

    // Cache the successful result for 24 hours
    setInCache(cacheKey, response);

    // Frontend expects: { success, data: { sources: [...] }, error? }
    // So we wrap in "data" as well for compatibility
    res.json({
      success: true,
      data: { sources: proxiedSources, subtitles: subtitles.length > 0 ? subtitles : undefined },
      fromCache: false,
      provider: providerUsed,
      sources: proxiedSources, // keep top-level for backward compat
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    } as any);
  } else {
    res.json({
      success: false,
      error: 'No stream sources could be resolved from any provider. The episode may not be available.',
    });
  }
});

export default router;


