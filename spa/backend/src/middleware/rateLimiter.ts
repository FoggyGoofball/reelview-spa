/**
 * rateLimiter.ts
 *
 * Global inbound rate limiting to protect the Render instance from abuse.
 *
 * Endpoint limits:
 *   POST /api/resolve-stream  → 20 req/min per IP  (heavy waterfall)
 *   GET  /api/proxy-stream    → 100 req/min per IP (streaming, bursty)
 *   POST /api/precache-stream → 10 req/min per IP  (background work)
 *
 * Uses express-rate-limit with the default in-memory store.
 */

import rateLimit from 'express-rate-limit';

// ── Shared config ──────────────────────────────────────────────────────────

const STANDARD_WINDOW_MS = 60 * 1000; // 1 minute window

/**
 * Return a human-readable "Retry-After" style message.
 */
function standardMessage(limit: number, endpoint: string): string {
  return `Too many requests to ${endpoint}. Limit: ${limit} per minute. Please slow down.`;
}

// ── Per-endpoint limiters ───────────────────────────────────────────────────

/**
 * POST /api/resolve-stream — 20 req/min
 * This is the most expensive endpoint (multi-provider waterfall). Cap it tight.
 */
export const resolveLimiter = rateLimit({
  windowMs: STANDARD_WINDOW_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: standardMessage(20, 'POST /api/resolve-stream'),
  },
});

/**
 * GET /api/proxy-stream — 100 req/min
 * Streaming can be bursty (HLS segment fetches), but 100/min should be
 * plenty for normal usage while still protecting against runaway loops.
 */
export const proxyLimiter = rateLimit({
  windowMs: STANDARD_WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: standardMessage(100, 'GET /api/proxy-stream'),
  },
});

/**
 * POST /api/precache-stream — 10 req/min
 * Background work — no need to hammer this.
 */
export const precacheLimiter = rateLimit({
  windowMs: STANDARD_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: standardMessage(10, 'POST /api/precache-stream'),
  },
});
