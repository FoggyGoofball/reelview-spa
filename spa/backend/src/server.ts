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

// ─── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[ReelView Engine] Server running on http://localhost:${PORT}`);
  console.log(`[ReelView Engine] POST /api/resolve-stream`);
});

export default app;
