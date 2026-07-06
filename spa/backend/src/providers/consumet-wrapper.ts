/**
 * Consumet Wrapper (Step 1)
 *
 * Uses @consumet/extensions to resolve a TV episode stream.
 * Tries FlixHQ first, then ViewVault as fallback.
 *
 * IMPORTANT: Consumet providers use their own internal ID systems — you cannot
 * pass TMDB IDs directly to fetchEpisodeSources. This wrapper does a
 * search-by-title first to find the provider's internal media ID.
 *
 * Signature: (title, tmdbId, season, episode)
 *   - title: The show title (used for Consumet search lookup)
 *   - tmdbId: The TMDB ID (used as secondary match criterion)
 *   - season/episode: Target episode
 */

import { throttledFetch } from '../lib/throttle.js';
import type { StreamSource } from './cinepro.types.js';
import { MOVIES } from '@consumet/extensions';

export async function resolveWithConsumet(
  title: string,
  tmdbId: string,
  season: number,
  episode: number,
): Promise<StreamSource[]> {
  if (!title) return [];

  // ─── Helper: try a specific Consumet provider ──────────────────────────
  async function tryProvider(
    ProviderCtor: new () => any,
    providerLabel: string,
  ): Promise<StreamSource[]> {
    try {
      // Throttle: small delay before creating provider to avoid burst-firing
      // multiple Consumet provider connections simultaneously.
      await new Promise(r => setTimeout(r, 500));
      const provider = new ProviderCtor();
      const searchResult = await provider.search(title);

      if (!searchResult?.results?.length) return [];

      // Find best match — prefer exact TMDB ID match, else take first result
      const show =
        searchResult.results.find((r: any) => {
          const rId = String(r.id || '');
          return rId.includes(tmdbId) || rId.endsWith(`/${tmdbId}`);
        }) || searchResult.results[0];

      if (!show?.id) return [];

      const episodeResult = await provider.fetchEpisodeSources(
        show.id,
        season,
        episode,
      );

      if (!episodeResult?.sources?.length) return [];

      return episodeResult.sources
        .filter((s: any) => s?.url)
        .map((s: any) => ({
          url: s.url,
          type: s.isM3U8 || s.url.includes('.m3u8') ? 'hls' : 'mp4',
          quality: s.quality || 'auto',
          server: `consumet-${providerLabel}`,
        }));
    } catch {
      return []; // swallow errors — waterfall will fall through
    }
  }

  // Step 1: Try FlixHQ
  let sources = await tryProvider(MOVIES.FlixHQ, 'flixhq');
  if (sources.length > 0) return sources;

  // Step 2: Try SFlix as secondary Consumet provider
  sources = await tryProvider(MOVIES.SFlix, 'sflix');
  if (sources.length > 0) return sources;

  return [];
}
