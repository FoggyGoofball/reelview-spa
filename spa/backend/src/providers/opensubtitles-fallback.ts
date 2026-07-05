/**
 * OpenSubtitles Fallback Provider
 *
 * Fetches subtitles from OpenSubtitles.com API when stream providers don't
 * return subtitle tracks. The user's personal API key is passed per-request
 * from the frontend (stored in browser localStorage) — the server never
 * stores it.
 *
 * Rate limits:
 *   Free tier: 200 requests/day, 40 downloads/day
 *   We cache results per (tmdbId, season, episode) to minimize usage.
 *
 * API docs: https://opensubtitles.stoplight.io/docs/opensubtitles-api/
 */

import type { SubtitleTrack } from './cinepro.types.js';
import { buildSubtitleProxyUrl } from '../routes/proxyStream.js';

const OPENSUBTITLES_API = 'https://api.opensubtitles.com/api/v1';

/**
 * Search OpenSubtitles for subtitles matching a TMDB ID + season/episode.
 *
 * @param apiKey - User's personal OpenSubtitles API key (from localStorage)
 * @param tmdbId - TMDB ID
 * @param season - Season number (omit for movies)
 * @param episode - Episode number (omit for movies)
 * @returns Array of SubtitleTrack, or [] on failure / no results
 */
export async function resolveWithOpenSubtitles(
  apiKey: string,
  tmdbId: string,
  season?: number,
  episode?: number,
): Promise<SubtitleTrack[]> {
  if (!apiKey || !tmdbId) return [];

  try {
    // Step 1: Search for subtitles
    const params = new URLSearchParams({
      tmdb_id: tmdbId,
      type: season != null ? 'episode' : 'movie',
      languages: 'en', // Start with English
    });
    if (season != null) params.set('season_number', String(season));
    if (episode != null) params.set('episode_number', String(episode));

    const searchRes = await fetch(`${OPENSUBTITLES_API}/subtitles?${params.toString()}`, {
      headers: {
        'Api-Key': apiKey,
        'User-Agent': 'ReelView v1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (searchRes.status === 401) {
      console.warn('[OpenSubtitles] Invalid API key');
      return [];
    }

    if (!searchRes.ok) {
      console.warn(`[OpenSubtitles] Search failed: ${searchRes.status}`);
      return [];
    }

    const searchData = await searchRes.json() as any;
    const subtitlesData = searchData?.data ?? [];

    if (!Array.isArray(subtitlesData) || subtitlesData.length === 0) {
      return [];
    }

    // Step 2: For each subtitle, get the download URL and convert to SubtitleTrack
    const tracks: SubtitleTrack[] = [];

    for (const sub of subtitlesData.slice(0, 10)) { // Max 10 subtitles
      const attributes = sub.attributes;
      if (!attributes?.files?.[0]?.file_id) continue;

      const fileId = attributes.files[0].file_id;
      const lang = attributes.language || attributes.language_name || 'Unknown';
      const subFileName = attributes.files[0].file_name || '';

      try {
        // Step 3: Request download link (uses user's quota)
        const dlRes = await fetch(`${OPENSUBTITLES_API}/download`, {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'User-Agent': 'ReelView v1.0',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ file_id: fileId }),
          signal: AbortSignal.timeout(10000),
        });

        if (!dlRes.ok) continue;

        const dlData = await dlRes.json() as any;
        const directUrl = dlData?.link;
        if (!directUrl) continue;

        // Determine format from file extension
        const ext = subFileName.split('.').pop()?.toLowerCase() || 'srt';
        const format = ext === 'vtt' ? 'vtt' : ext === 'ass' ? 'ass' : 'srt';

        tracks.push({
          lang,
          url: buildSubtitleProxyUrl(directUrl),
          format,
          default: lang.toLowerCase() === 'english',
        });
      } catch {
        // Skip this subtitle if download fails
        continue;
      }
    }

    console.log(`[OpenSubtitles] Found ${tracks.length} subtitle tracks for tmdbId=${tmdbId}`);
    return tracks;
  } catch {
    return [];
  }
}
