/**
 * precacheStream.ts
 *
 * Fire-and-forget background pre-cache endpoint.
 *
 * When a user resolves episode N, the frontend can also pre-resolve adjacent
 * episodes (N–1, N+1, N+2) in the background so navigating to them feels
 * instant (cache hit).
 *
 * POST /api/precache-stream
 * Request body:
 *   {
 *     "tmdbId": "1399",
 *     "type": "tv",
 *     "title": "Breaking Bad",
 *     "episodes": [
 *       {"season": 5, "episode": 14},
 *       {"season": 5, "episode": 16},
 *       {"season": 5, "episode": 17}
 *     ]
 *   }
 *
 * Behaviour:
 *   - Check cache for each episode — skip if cached
 *   - For misses: call CinePro first (faster), fall back to Consumet
 *   - Sequential processing with 3-second delay between episodes
 *   - 15 s timeout per episode so it doesn't hang
 *   - Returns { success: true } immediately — fire-and-forget
 */

import { Router, type Request, type Response } from 'express';
import { getFromCache, setInCache, getCacheKey } from '../cache.js';
import { resolveWithCinePro } from '../providers/cinepro-fallback.js';
import { resolveWithConsumet } from '../providers/consumet-wrapper.js';
import { buildProxyUrl } from './proxyStream.js';
import type { StreamSource, SubtitleTrack } from '../providers/cinepro.types.js';

const router = Router();

// ── Types ───────────────────────────────────────────────────────────────────

interface PrecacheEpisode {
  season: number;
  episode: number;
}

interface PrecacheRequest {
  tmdbId: string;
  type: 'tv' | 'movie';
  title?: string;
  episodes: PrecacheEpisode[];
}

// ── Constants ───────────────────────────────────────────────────────────────

const EPISODE_TIMEOUT_MS = 15_000; // 15 s per episode
const DELAY_BETWEEN_EPISODES_MS = 3_000; // 3 s between episodes

// ── Endpoint ────────────────────────────────────────────────────────────────

router.post('/precache-stream', async (req: Request, res: Response) => {
  const { tmdbId, type, title, episodes } = req.body as PrecacheRequest;

  // ── Validation ──────────────────────────────────────────────────────
  if (!tmdbId || typeof tmdbId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid tmdbId' });
  }
  if (!Array.isArray(episodes) || episodes.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or empty episodes array' });
  }
  if (type !== 'tv') {
    return res.status(400).json({ success: false, error: 'Only tv type is supported for pre-cache' });
  }

  const showTitle = title || '';

  // ── Fire-and-forget ─────────────────────────────────────────────────
  // Return immediately so the frontend doesn't block.
  res.json({ success: true, message: `Pre-cache started for ${episodes.length} episode(s)` });

  // ── Background processing ───────────────────────────────────────────
  processEpisodes(tmdbId, showTitle, episodes).catch((err) => {
    console.error('[PreCache] Background processing error:', err);
  });
});

// ── Background processor ────────────────────────────────────────────────────

async function processEpisodes(
  tmdbId: string,
  title: string,
  episodes: PrecacheEpisode[],
): Promise<void> {
  let cached = 0;
  let resolved = 0;
  let failed = 0;

  for (let i = 0; i < episodes.length; i++) {
    const { season, episode } = episodes[i];

    // Delay between episodes (skip delay for the first one)
    if (i > 0) {
      await sleep(DELAY_BETWEEN_EPISODES_MS);
    }

    const cacheKey = getCacheKey(tmdbId, season, episode);
    const cachedEntry = getFromCache<unknown>(cacheKey);
    if (cachedEntry) {
      cached++;
      console.log(`[PreCache] CACHE HIT  tmdbId=${tmdbId}  S=${season}  E=${episode}  — skipping`);
      continue;
    }

    try {
      console.log(`[PreCache] RESOLVING  tmdbId=${tmdbId}  S=${season}  E=${episode}  title=${title}`);
      await resolveSingleEpisode(tmdbId, season, episode, title);
      resolved++;
      console.log(`[PreCache] RESOLVED OK  tmdbId=${tmdbId}  S=${season}  E=${episode}`);
    } catch (err) {
      failed++;
      console.warn(`[PreCache] RESOLVE FAIL  tmdbId=${tmdbId}  S=${season}  E=${episode}  error=${err}`);
    }
  }

  console.log(
    `[PreCache] COMPLETE  tmdbId=${tmdbId}  ` +
    `total=${episodes.length}  cached=${cached}  resolved=${resolved}  failed=${failed}`,
  );
}

/**
 * Resolve a single episode: try CinePro first (faster), fall back to Consumet.
 * On success, store the result in the persistent cache.
 */
async function resolveSingleEpisode(
  tmdbId: string,
  season: number,
  episode: number,
  title: string,
): Promise<void> {
  const cacheKey = getCacheKey(tmdbId, season, episode);

  // 1. Try CinePro (fast waterfall, runs providers in parallel)
  const cineProResult = await withTimeout(
    resolveWithCinePro(tmdbId, season, episode),
    EPISODE_TIMEOUT_MS,
  );

  let sources: StreamSource[];
  let subtitles: SubtitleTrack[];

  if (cineProResult.sources.length > 0) {
    sources = cineProResult.sources;
    subtitles = cineProResult.subtitles || [];
  } else if (title) {
    // 2. Fallback to Consumet
    const consumetSources = await withTimeout(
      resolveWithConsumet(title, tmdbId, season, episode),
      EPISODE_TIMEOUT_MS,
    );
    sources = consumetSources;
    subtitles = [];
  } else {
    // No sources found at all
    return;
  }

  if (sources.length === 0) return;

  // Build proxy URLs for cached entries
  const proxied = sources.map((s) => ({
    ...s,
    url: buildProxyUrl(s.url, s.headers),
  }));

  const response = {
    success: true,
    data: {
      sources: proxied,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    },
    fromCache: false,
    provider: cineProResult.sources.length > 0 ? 'cinepro' : 'consumet',
    sources: proxied,
    subtitles: subtitles.length > 0 ? subtitles : undefined,
  };

  setInCache(cacheKey, response);
}

// ── Utility ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback?: T,
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error(`Timeout after ${ms}ms`);
  }
}

export default router;
