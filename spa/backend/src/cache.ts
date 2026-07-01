import NodeCache from 'node-cache';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * In-memory cache for resolved stream URLs.
 * Key format: `${tmdbId}_${season}_${episode}`
 */
const cache = new NodeCache({
  stdTTL: CACHE_TTL_SECONDS,
  checkperiod: 60 * 60, // check for expired keys every hour
});

export function getCacheKey(tmdbId: string, season: number, episode: number): string {
  return `${tmdbId}_${season}_${episode}`;
}

export function getFromCache<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setInCache<T>(key: string, value: T): void {
  cache.set(key, value);
}

export default cache;
