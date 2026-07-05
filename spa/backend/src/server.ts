/**
 * ReelView Backend Server
 *
 * Express server that exposes the direct-stream resolution engine:
 *   POST /api/resolve-stream
 *
 * Expects JSON body: { tmdbId, type: "tv", season, episode }
 */

import express from 'express';
import cors from 'cors';
import resolveRouter from './routes/resolveStream.js';
import proxyRouter from './routes/proxyStream.js';
import persistentCache from './cache.js';
import { CACHE_TTL_SECONDS } from './cache.js';

const app = express();
const PORT = Number(process.env.PORT) || 3006;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', resolveRouter);
app.use('/api', proxyRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Clear cache endpoint (for debugging / manual invalidation)
app.get('/api/clear-cache', (_req, res) => {
  const statsBefore = persistentCache.stats();
  // We can only clear the persistent cache exposed via the singleton.
  // The PersistentCache has a flushSync but no public "clear all" — we
  // enumerate keys and delete them individually.
  for (const key of statsBefore.keys) {
    persistentCache.del(key);
  }
  const statsAfter = persistentCache.stats();
  res.json({
    success: true,
    message: 'Cache cleared',
    cleared: statsBefore.keyCount,
    remaining: statsAfter.keyCount,
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[ReelView Engine] Server running on http://localhost:${PORT}`);
  console.log(`[ReelView Engine] POST /api/resolve-stream`);
});

export default app;
