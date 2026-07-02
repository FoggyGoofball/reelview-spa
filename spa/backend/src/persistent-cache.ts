/**
 * persistent-cache.ts
 *
 * Hybrid cache: in-memory NodeCache for O(1) reads, backed by a JSON file on
 * disk so entries survive server restarts (e.g. after a Render.com deploy).
 *
 * Also includes a background link-verification loop that periodically re-checks
 * cached stream URLs and evicts dead links.
 *
 * No native dependencies — uses Node.js built-in fs + path.
 */

import fs from 'node:fs';
import path from 'node:path';
import NodeCache from 'node-cache';

// ── Configuration ──────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24-hour TTL
const CACHE_CHECK_PERIOD = 60 * 60; // evict expired keys every hour
const DISK_SYNC_DEBOUNCE_MS = 2_000; // wait 2 s after last write before flushing
const VERIFY_INTERVAL_MS = 6 * 60 * 60 * 1000; // verify cached entries every 6 h
const VERIFY_TIMEOUT_MS = 8_000; // per-URL timeout during verification

const DISK_PATH = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../../data/cache.json',
);

// ── Types ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  /** ISO-8601 timestamp of when the entry was created */
  createdAt: string;
  /** The wrapped value (the ResolveStreamResponse) */
  value: unknown;
  /** Number of times this entry has been served from cache */
  hitCount: number;
}

interface PersistedData {
  entries: Record<string, CacheEntry>;
}

// ── Persistent Cache Class ─────────────────────────────────────────────────

class PersistentCache {
  private mem: NodeCache;
  /** Backing store loaded from / written to disk */
  private entries: Record<string, CacheEntry> = {};
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private verifyTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.mem = new NodeCache({
      stdTTL: CACHE_TTL_SECONDS,
      checkperiod: CACHE_CHECK_PERIOD,
    });

    this.loadFromDisk();
    this.startVerificationLoop();

    // Flush pending writes when the process is about to exit
    process.on('beforeExit', () => this.flushSync());
    process.on('SIGTERM', () => this.flushSync());
    process.on('SIGINT', () => this.flushSync());
  }

  // ── Public API ─────────────────────────────────────────────────────────

  get<T>(key: string): T | undefined {
    // Fast path: in-memory hit
    const fromMem = this.mem.get<T>(key);
    if (fromMem !== undefined) {
      const entry = this.entries[key];
      if (entry) {
        entry.hitCount++;
        console.log(`[Cache] HIT  key=${key}  hits=${entry.hitCount}`);
      }
      return fromMem;
    }

    // Slow path: check persisted data in case it hasn't been loaded into mem
    const entry = this.entries[key];
    if (entry) {
      // Re-populate the in-memory cache
      this.mem.set(key, entry.value);
      entry.hitCount++;
      console.log(`[Cache] RESTORED key=${key}  hits=${entry.hitCount}`);
      return entry.value as T;
    }

    console.log(`[Cache] MISS key=${key}`);
    return undefined;
  }

  set<T>(key: string, value: T): void {
    this.mem.set(key, value);

    this.entries[key] = {
      createdAt: new Date().toISOString(),
      value,
      hitCount: 0,
    };

    this.markDirty();
  }

  /** Remove a specific key from both memory and disk */
  del(key: string): void {
    this.mem.del(key);
    delete this.entries[key];
    this.markDirty();
  }

  /** Return a snapshot of cache keys (for stats / debugging) */
  stats(): { keyCount: number; keys: string[] } {
    const keys = Object.keys(this.entries);
    return { keyCount: keys.length, keys };
  }

  /** Flush pending writes immediately */
  flushSync(): void {
    if (!this.dirty) return;
    this.writeToDisk();
  }

  // ── Disk I/O ──────────────────────────────────────────────────────────

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(DISK_PATH)) {
        console.log('[Cache] No disk cache found at', DISK_PATH);
        return;
      }

      const raw = fs.readFileSync(DISK_PATH, 'utf-8');
      const data: PersistedData = JSON.parse(raw);

      if (!data.entries || typeof data.entries !== 'object') {
        console.warn('[Cache] Invalid cache file format, starting fresh');
        return;
      }

      this.entries = data.entries;

      // Populate in-memory cache only with non-expired entries
      const now = Date.now();
      let restored = 0;
      let expired = 0;

      for (const [key, entry] of Object.entries(this.entries)) {
        const age = now - new Date(entry.createdAt).getTime();
        const ttlMs = CACHE_TTL_SECONDS * 1000;

        if (age < ttlMs) {
          const remainingTtl = Math.ceil((ttlMs - age) / 1000);
          this.mem.set(key, entry.value, remainingTtl);
          restored++;
        } else {
          delete this.entries[key];
          expired++;
        }
      }

      console.log(
        `[Cache] Loaded from disk: ${restored} active, ${expired} expired, ${Object.keys(this.entries).length} total`,
      );
    } catch (err) {
      console.error('[Cache] Failed to load from disk, starting fresh', err);
      this.entries = {};
    }
  }

  private writeToDisk(): void {
    try {
      const dir = path.dirname(DISK_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data: PersistedData = { entries: this.entries };
      fs.writeFileSync(DISK_PATH, JSON.stringify(data, null, 2), 'utf-8');
      this.dirty = false;

      console.log(
        `[Cache] Flushed ${Object.keys(this.entries).length} entries to disk`,
      );
    } catch (err) {
      console.error('[Cache] Failed to write cache to disk', err);
    }
  }

  private markDirty(): void {
    this.dirty = true;

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.writeToDisk();
      this.syncTimer = null;
    }, DISK_SYNC_DEBOUNCE_MS);
  }

  // ── Background Link Verification ──────────────────────────────────────

  private startVerificationLoop(): void {
    // Run one verification pass after a short delay, then every VERIFY_INTERVAL
    setTimeout(() => this.verifyCachedLinks(), 30_000);
    this.verifyTimer = setInterval(
      () => this.verifyCachedLinks(),
      VERIFY_INTERVAL_MS,
    );
  }

  /**
   * Iterate over all cached entries and check whether the first stream URL
   * is still reachable. If it returns a 4xx/5xx or times out, the entry is
   * evicted from the cache so the next request will re-resolve fresh links.
   *
   * This prevents users from being served dead / expired stream URLs.
   */
  private async verifyCachedLinks(): Promise<void> {
    const keys = Object.keys(this.entries);
    if (keys.length === 0) return;

    console.log(`[Cache] Starting background verification of ${keys.length} entries...`);

    let verified = 0;
    let evicted = 0;
    let failed = 0;

    for (const key of keys) {
      const entry = this.entries[key];
      if (!entry) continue;

      // Try to extract the first stream URL from the cached response
      const url = this.extractFirstUrl(entry.value);
      if (!url) {
        // No URL to verify — leave the entry alone
        verified++;
        continue;
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

        const res = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        clearTimeout(timer);

        if (res.ok || res.status === 206) {
          verified++;
        } else {
          console.warn(
            `[Cache] VERIFY FAIL  key=${key}  status=${res.status}  url=${url.slice(0, 80)}...  EVICTING`,
          );
          this.del(key);
          evicted++;
        }
      } catch {
        // Timeout or network error — evict
        console.warn(
          `[Cache] VERIFY TIMEOUT/ERROR  key=${key}  url=${url.slice(0, 80)}...  EVICTING`,
        );
        this.del(key);
        evicted++;
      }
    }

    console.log(
      `[Cache] Verification complete: ${verified} ok, ${evicted} evicted, ${failed} errors`,
    );
  }

  /**
   * Try to extract the first stream URL from a cached ResolveStreamResponse
   * (which can be in several shapes).
   */
  private extractFirstUrl(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;

    const obj = value as Record<string, unknown>;

    // Try the "sources" array
    const sources = obj.sources;
    if (Array.isArray(sources) && sources.length > 0) {
      const first = sources[0] as Record<string, unknown> | undefined;
      if (first?.url && typeof first.url === 'string') return first.url;
    }

    // Try "data.sources" (alternate response shape)
    const data = obj.data as Record<string, unknown> | undefined;
    if (data) {
      const dataSources = data.sources;
      if (Array.isArray(dataSources) && dataSources.length > 0) {
        const first = dataSources[0] as Record<string, unknown> | undefined;
        if (first?.url && typeof first.url === 'string') return first.url;
      }
    }

    return null;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

const persistentCache = new PersistentCache();
export default persistentCache;
