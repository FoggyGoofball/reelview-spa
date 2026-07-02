/**
 * cache.ts
 *
 * Drop-in replacement for the original in-memory-only cache.
 * Delegates to the PersistentCache for disk-backed, restart-persistent storage
 * with background link verification.
 *
 * Exports the same getCacheKey / getFromCache / setInCache interface so no
 * other files need to change.
 */

import persistentCache from './persistent-cache.js';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export function getCacheKey(tmdbId: string, season: number, episode: number): string {
  return `${tmdbId}_${season}_${episode}`;
}

export function getFromCache<T>(key: string): T | undefined {
  return persistentCache.get<T>(key);
}

export function setInCache<T>(key: string, value: T): void {
  persistentCache.set(key, value);
}

export { CACHE_TTL_SECONDS };
export default persistentCache;
