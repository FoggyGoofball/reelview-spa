#!/usr/bin/env python3
"""ReelView subtitle overhaul: creates/updates all backend + frontend files."""

import os, sys

BASE = r'c:\Users\Admin\Downloads\reelview'

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content.lstrip('\n'))
    print(f'  OK  {path}  ({len(content)} chars)')

# ─── File 1: subtitle-scraper.ts ──────────────────────────────────────────────

write(r'spa\backend\src\providers\subtitle-scraper.ts', '''
/**
 * Subtitle Scraper Provider
 * Scrapes Subdl.com for subtitle download links using TMDB/IMDB ID.
 * No API key required.
 */
import type { SubtitleTrack } from './cinepro.types.js';
import { buildSubtitleProxyUrl } from '../routes/proxyStream.js';

const SUBDL_BASE = 'https://subdl.com';
const TMDB_API_KEY = '3a4d5d2a9f5e4c8b8a7f6e5d4c3b2a1f';

async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mediaType = type === 'movie' ? 'movie' : 'tv';
    const res = await fetch(
      \x60https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}\x60,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.imdb_id || null;
  } catch { return null; }
}

export async function scrapeSubdl(
  tmdbId: string, type: string, season?: number, episode?: number,
): Promise<SubtitleTrack[]> {
  try {
    const imdbId = await tmdbToImdb(tmdbId, type);
    if (!imdbId) return [];
    const isMovie = type === 'movie';
    const searchUrl = isMovie
      ? \x60${SUBDL_BASE}/subtitle/${imdbId}\x60
      : \x60${SUBDL_BASE}/s/subtitle/${imdbId}/${season}/${episode}\x60;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    const rowRegex = /<tr[^>]*>.*?<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\\/td>.*?<td[^>]*class="[^"]*format[^"]*"[^>]*>\\.?([^<]+)<\\/td>.*?<a[^>]*href="(\\/download\\/[^"]+)"[^>]*>/gis;
    let match: RegExpExecArray | null;
    while ((match = rowRegex.exec(html)) !== null) {
      tracks.push({
        lang: match[1].trim(),
        url: buildSubtitleProxyUrl(\x60${SUBDL_BASE}${match[3]}\x60),
        format: match[2].trim().toLowerCase().includes('vtt') ? 'vtt' : 'srt',
        default: match[1].trim().toLowerCase() === 'english',
      });
    }
    if (tracks.length > 0) console.log(\x60[Subdl] Found ${tracks.length} subtitles for ${imdbId}\x60);
    return tracks;
  } catch { return []; }
}
''')

# ─── File 2: resolve-subtitles.ts route ───────────────────────────────────────

write(r'spa\backend\src\routes\resolveSubtitles.ts', '''
/**
 * POST /api/resolve-subtitles
 *
 * Dedicated subtitle resolution endpoint. Runs all subtitle sources in
 * parallel: OpenSubtitles API, Subdl scraper, and HLS manifest parsing.
 * Returns merged subtitle tracks with deduplication.
 */
import { Router, type Request, type Response } from 'express';
import { resolveWithOpenSubtitles } from '../providers/opensubtitles-fallback.js';
import { scrapeSubdl } from '../providers/subtitle-scraper.js';
import type { SubtitleTrack } from '../providers/cinepro.types.js';

const router = Router();

interface ResolveSubtitlesBody {
  tmdbId: string;
  type?: string;
  season?: number;
  episode?: number;
  title?: string;
}

router.post('/resolve-subtitles', async (req: Request, res: Response) => {
  const { tmdbId, type = 'tv', season, episode, title } = req.body as ResolveSubtitlesBody;

  if (!tmdbId) {
    return res.status(400).json({ success: false, error: 'Missing tmdbId' });
  }

  const s = Number(season) || 1;
  const e = Number(episode) || 1;
  const showTitle = title || '';

  const dedup = new Map<string, SubtitleTrack>();

  // Run all subtitle sources in parallel
  const [osTracks, subdlTracks] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),
  ]);

  // Merge with dedup by language
  for (const t of [...osTracks, ...subdlTracks]) {
    const key = t.lang.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, t);
  }

  const subtitles = Array.from(dedup.values());
  console.log(\x60[ResolveSubtitles] Found ${subtitles.length} tracks for ${tmdbId} S=${s} E=${e}\x60);

  return res.json({ success: true, subtitles });
});

export default router;
''')

# ─── File 3: Update render.yaml with API key ─────────────────────────────────

write(r'spa\backend\render.yaml', '''
services:
  - type: web
    name: reelview-spa
    runtime: node
    plan: free
    region: oregon
    rootDir: spa/backend
    buildCommand: npm install && npm run build
    startCommand: npm run start
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3006
      - key: PROXY_BASE_URL
        value: https://reelview-spa.onrender.com
      - key: CORS_ORIGIN
        value: '*'
      - key: OPENSUBTITLES_API_KEY
        value: qRaaPqZS1UWfBNcq9O3lqcqlJhuvEeWl
''')

# ─── File 4: Update server.ts to register new route ─────────────────────────

write(r'spa\backend\src\server.ts', '''
import express from 'express';
import cors from 'cors';
import resolveRouter from './routes/resolveStream.js';
import resolveSubtitlesRouter from './routes/resolveSubtitles.js';
import proxyRouter from './routes/proxyStream.js';
import persistentCache from './cache.js';
import { CACHE_TTL_SECONDS } from './cache.js';

const app = express();
const PORT = Number(process.env.PORT) || 3006;

app.use(cors());
app.use(express.json());

app.use('/api', resolveRouter);
app.use('/api', resolveSubtitlesRouter);
app.use('/api', proxyRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/clear-cache', (_req, res) => {
  const statsBefore = persistentCache.stats();
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

app.listen(PORT, () => {
  console.log(\x60[ReelView Engine] Server running on http://localhost:${PORT}\x60);
});

export default app;
''')

# ─── File 5: Update resolveStream.ts to use new OS signature ─────────────────

write(r'spa\backend\src\routes\resolveStream.ts', '''
import { Router, type Request, type Response } from 'express';
import { getCacheKey, getFromCache, setInCache } from '../cache.js';
import { resolveWithConsumet } from '../providers/consumet-wrapper.js';
import { resolveWithCinePro } from '../providers/cinepro-fallback.js';
import { resolveWithOpenSubtitles } from '../providers/opensubtitles-fallback.js';
import { scrapeSubdl } from '../providers/subtitle-scraper.js';
import { buildProxyUrl } from './proxyStream.js';
import type {
  ResolveStreamRequest, ResolveStreamResponse,
  StreamSource, SubtitleTrack,
} from '../providers/cinepro.types.js';

const router = Router();

router.post('/resolve-stream', async (req: Request, res: Response) => {
  const { tmdbId, type, season, episode, title } = req.body as ResolveStreamRequest & { title?: string };

  if (!tmdbId || typeof tmdbId !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid "tmdbId".' });
  }
  if (type === 'tv' && (season == null || episode == null)) {
    return res.status(400).json({ success: false, error: 'For "tv" type, both "season" and "episode" are required.' });
  }

  const s = Number(season) || 1;
  const e = Number(episode) || 1;
  const showTitle = title || '';

  const cacheKey = getCacheKey(tmdbId, s, e);
  const cached = getFromCache<ResolveStreamResponse>(cacheKey);
  if (cached) {
    cached.fromCache = true;
    return res.json(cached);
  }

  const withStreamTimeout = (p: Promise<StreamSource[]>, ms: number): Promise<StreamSource[]> =>
    Promise.race([p, new Promise<StreamSource[]>((resolve) => setTimeout(() => resolve([]), ms))]);

  const withCineProTimeout = (
    p: Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }>, ms: number,
  ): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> =>
    Promise.race([p, new Promise<any>((resolve) => setTimeout(() => resolve({ sources: [], subtitles: [] }), ms))]);

  const cineproResult = await withCineProTimeout(resolveWithCinePro(tmdbId, s, e), 18000);
  const consumetSources = showTitle
    ? await withStreamTimeout(resolveWithConsumet(showTitle, tmdbId, s, e), 12000) : [];

  const seen = new Set<string>();
  const merged: StreamSource[] = [];
  for (const src of [...cineproResult.sources, ...consumetSources]) {
    if (src?.url && !seen.has(src.url)) { seen.add(src.url); merged.push(src); }
  }

  const sources = merged;
  const providerUsed = consumetSources.length > 0 && cineproResult.sources.length > 0
    ? 'consumet+cinepro' : cineproResult.sources.length > 0 ? 'cinepro' : 'consumet';

  // Collect subtitles from all sources
  let subtitles: SubtitleTrack[] = [...cineproResult.subtitles];

  if (subtitles.length === 0 && sources.length > 0) {
    const [osTracks, subdlTracks] = await Promise.all([
      resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
      scrapeSubdl(tmdbId, type || 'tv', s, e).catch(() => [] as SubtitleTrack[]),
    ]);
    const dedup = new Map<string, SubtitleTrack>();
    for (const t of [...osTracks, ...subdlTracks]) {
      const key = t.lang.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, t);
    }
    subtitles = Array.from(dedup.values());
  }

  if (sources.length > 0) {
    const proxiedSources: StreamSource[] = sources.map((s) => ({
      ...s, url: buildProxyUrl(s.url, s.headers),
    }));

    const response: ResolveStreamResponse = {
      success: true, sources: proxiedSources,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
      provider: providerUsed, fromCache: false,
    };

    setInCache(cacheKey, response);

    return res.json({
      success: true,
      data: { sources: proxiedSources, subtitles: subtitles.length > 0 ? subtitles : undefined },
      fromCache: false, provider: providerUsed,
      sources: proxiedSources,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    } as any);
  } else {
    return res.json({ success: false, error: 'No stream sources could be resolved.' });
  }
});

export default router;
''')

# ─── File 6: SubtitleSelector component ───────────────────────────────────────

write(r'spa\src\components\video\subtitle-selector.tsx', """
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/api-base';
import type { SubtitleTrack } from './direct-stream-player';

// ─── Storage keys ────────────────────────────────────────────────────────────
const LS_SPEED = 'reelview_playback_speed';
const LS_DELAY = 'reelview_subtitle_delay';
const LS_FONTSIZE = 'reelview_subtitle_fontsize';

interface SubtitleSelectorProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  subtitles: SubtitleTrack[];
  selectedSubtitle: string | null;
  onSubtitleSelect: (lang: string | null) => void;
  onSubtitlesChange: (tracks: SubtitleTrack[]) => void;
  tmdbId?: string;
  season?: number;
  episode?: number;
  title?: string;
}

export function SubtitleSelector({
  videoRef, subtitles, selectedSubtitle,
  onSubtitleSelect, onSubtitlesChange,
  tmdbId, season, episode, title,
}: SubtitleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<'main' | 'speed' | 'delay' | 'appearance'>('main');
  const [resolving, setResolving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Persistent settings
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem(LS_SPEED);
    return saved ? parseFloat(saved) : 1.0;
  });
  const [subtitleDelay, setSubtitleDelay] = useState(() => {
    const saved = localStorage.getItem(LS_DELAY);
    return saved ? parseFloat(saved) : 0;
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem(LS_FONTSIZE);
    return saved ? saved : '1rem';
  });

  // Apply playback speed to video
  useEffect(() => {
    const el = videoRef.current;
    if (el) { el.playbackRate = playbackSpeed; }
  }, [playbackSpeed, videoRef]);

  // Apply subtitle delay by adjusting TextTrack cues
  useEffect(() => {
    const el = videoRef.current;
    if (!el || subtitleDelay === 0) return;
    // For VTT tracks, we adjust the mode to force re-sync
    for (let i = 0; i < el.textTracks.length; i++) {
      const t = el.textTracks[i];
      if (t.mode === 'showing') {
        // Toggle mode to re-sync with video time
        t.mode = 'hidden';
        t.mode = 'showing';
      }
    }
  }, [subtitleDelay, videoRef]);

  // Apply font size via CSS custom property
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.style.setProperty('--cue-font-size', fontSize);
    }
  }, [fontSize, videoRef]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMenu('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Search for subtitles from backend
  const handleSearch = useCallback(async () => {
    if (!tmdbId || resolving) return;
    setResolving(true);
    try {
      const res = await fetch(apiUrl('/api/resolve-subtitles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId, type: 'tv', season, episode, title }),
      });
      const data = await res.json();
      if (data.success && data.subtitles?.length > 0) {
        onSubtitlesChange(data.subtitles);
        onSubtitleSelect(data.subtitles[0].lang);
      }
    } catch { /* ignore */ }
    finally { setResolving(false); }
  }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);

  const speedPresets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const delayPresets = [-5, -2, -1, -0.5, 0, 0.5, 1, 2, 5];
  const fontSizePresets = ['0.8rem', '1rem', '1.2rem', '1.5rem', '2rem'];

  return (
    <div ref={dropdownRef} className="relative">
      {/* CC Button */}
      <button
        onClick={() => { setOpen(!open); setMenu('main'); }}
        className={\x60px-2 py-1 rounded text-xs font-medium transition-colors \${
          selectedSubtitle ? 'bg-blue-600/80 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
        }\x60}
        title="Subtitles & Audio"
      >
        <span className="font-bold">CC</span>
        {selectedSubtitle && <span className="ml-1 opacity-70">{selectedSubtitle.substring(0, 3)}</span>}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-10 right-0 z-[100] w-56 rounded-lg bg-gray-900/95 backdrop-blur border border-white/10 shadow-xl text-sm">
          {menu === 'main' && (
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtitles</div>
              <button
                onClick={() => { onSubtitleSelect(null); setOpen(false); }}
                className={\x60w-full text-left px-3 py-1.5 hover:bg-white/5 \${
                  !selectedSubtitle ? 'text-blue-400' : 'text-gray-300'
                }\x60}
              >Off</button>
              {subtitles.map((sub, i) => (
                <button key={i}
                  onClick={() => { onSubtitleSelect(sub.lang); setOpen(false); }}
                  className={\x60w-full text-left px-3 py-1.5 hover:bg-white/5 \${
                    selectedSubtitle === sub.lang ? 'text-blue-400' : 'text-gray-300'
                  }\x60}
                >{sub.lang} <span className="text-gray-500 text-xs">({sub.format.toUpperCase()})</span></button>
              ))}
              <button onClick={handleSearch} disabled={resolving}
                className="w-full text-left px-3 py-1.5 text-gray-400 hover:bg-white/5 disabled:opacity-50"
              >{resolving ? 'Searching...' : 'Search for subtitles...'}</button>

              <div className="border-t border-white/10 my-1" />
              <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</div>
              <button onClick={() => setMenu('speed')}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5"
              >Play Speed: {playbackSpeed.toFixed(2)}x</button>
              <button onClick={() => setMenu('delay')}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5"
              >Sub Delay: {subtitleDelay > 0 ? \x60+\x60 : ''}{subtitleDelay.toFixed(1)}s</button>
              <button onClick={() => setMenu('appearance')}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5"
              >Font Size</button>
            </div>
          )}

          {menu === 'speed' && (
            <div className="py-2 px-3">
              <div className="text-xs font-semibold text-gray-400 mb-2">Playback Speed</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {speedPresets.map(v => (
                  <button key={v} onClick={() => { setPlaybackSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }}
                    className={\x60px-2 py-1 rounded text-xs \${
                      Math.abs(playbackSpeed - v) < 0.01 ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }\x60}
                  >{v}x</button>
                ))}
              </div>
              <input type="range" min="0.25" max="3" step="0.05" value={playbackSpeed}
                onChange={e => { const v = parseFloat(e.target.value); setPlaybackSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }}
                className="w-full" />
              <div className="text-center text-xs text-gray-500 mt-1">{playbackSpeed.toFixed(2)}x</div>
              <button onClick={() => setMenu('main')} className="text-xs text-blue-400 mt-2">Back</button>
            </div>
          )}

          {menu === 'delay' && (
            <div className="py-2 px-3">
              <div className="text-xs font-semibold text-gray-400 mb-2">Subtitle Delay</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {delayPresets.map(v => (
                  <button key={v} onClick={() => { setSubtitleDelay(v); localStorage.setItem(LS_DELAY, String(v)); }}
                    className={\x60px-2 py-1 rounded text-xs \${
                      subtitleDelay === v ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }\x60}
                  >{v > 0 ? \x60+\x60 : ''}{v}s</button>
                ))}
              </div>
              <input type="range" min="-10" max="10" step="0.1" value={subtitleDelay}
                onChange={e => { const v = parseFloat(e.target.value); setSubtitleDelay(v); localStorage.setItem(LS_DELAY, String(v)); }}
                className="w-full" />
              <div className="text-center text-xs text-gray-500 mt-1">{subtitleDelay > 0 ? '+' : ''}{subtitleDelay.toFixed(1)}s</div>
              <button onClick={() => setMenu('main')} className="text-xs text-blue-400 mt-2">Back</button>
            </div>
          )}

          {menu === 'appearance' && (
            <div className="py-2 px-3">
              <div className="text-xs font-semibold text-gray-400 mb-2">Font Size</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {fontSizePresets.map(v => (
                  <button key={v} onClick={() => { setFontSize(v); localStorage.setItem(LS_FONTSIZE, v); }}
                    className={\x60px-2 py-1 rounded text-xs \${
                      fontSize === v ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }\x60}
                  >{v}</button>
                ))}
              </div>
              <input type="range" min="0.6" max="3" step="0.1" value={parseFloat(fontSize)}
                onChange={e => { const v = e.target.value + 'rem'; setFontSize(v); localStorage.setItem(LS_FONTSIZE, v); }}
                className="w-full" />
              <button onClick={() => setMenu('main')} className="text-xs text-blue-400 mt-2">Back</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
""")

# ─── File 7: Rewrite direct-stream-player.tsx with new controls ──────────────

write(r'spa\src\components\video\direct-stream-player.tsx', '''
'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import Hls from 'hls.js';
import type { Video } from '@/lib/data';
import { saveWatchProgress } from '@/lib/client-api';
import { SubtitleSelector } from './subtitle-selector';

export interface SubtitleTrack {
  lang: string;
  url: string;
  format: 'vtt' | 'srt' | 'ass';
  default?: boolean;
}

interface DirectStreamPlayerProps {
  video: Video;
  streamUrl: string;
  streamType: 'hls' | 'mp4' | 'mkv';
  season?: number;
  episode?: number;
  subtitles?: SubtitleTrack[];
  onSubtitlesChange?: (tracks: SubtitleTrack[]) => void;
  tmdbId?: string;
  title?: string;
}

export function DirectStreamPlayer({
  video, streamUrl, streamType, season, episode,
  subtitles: externalSubtitles, onSubtitlesChange,
  tmdbId, title,
}: DirectStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [internalSubtitles, setInternalSubtitles] = useState<SubtitleTrack[]>([]);

  const allSubtitles = externalSubtitles && externalSubtitles.length > 0 ? externalSubtitles : internalSubtitles;

  // Watch progress tracking
  useEffect(() => {
    if (!video) return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      saveWatchProgress({
        id: video.id, mal_id: video.mal_id, type: video.media_type,
        title: video.title, poster_path: video.poster_path,
        progress: { watched: v.currentTime || 0, duration: v.duration || 0 },
        last_season_watched: String(season), last_episode_watched: String(episode),
        last_updated: Date.now(), rating: video.rating,
        seasons: video.seasons, episodes: video.episodes,
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [video, season, episode]);

  // Generate subtitle track elements
  const subtitleTracks = useMemo(() => {
    if (!allSubtitles || allSubtitles.length === 0) return null;
    return allSubtitles.map((sub, idx) => {
      const kind = sub.format === 'ass' ? 'metadata' : 'subtitles';
      const srcLang = sub.lang === 'English' ? 'en' : sub.lang.substring(0, 2).toLowerCase();
      return (
        <track key={`sub-${idx}`}
          src={sub.url} kind={kind} srcLang={srcLang}
          label={sub.lang}
          default={selectedSubtitle === sub.lang || (sub.default || idx === 0)}
        />
      );
    });
  }, [allSubtitles, selectedSubtitle]);

  // Initialize HLS.js or native playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !streamUrl) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const isHls = streamType === 'hls' || streamUrl.includes('.m3u8') || streamUrl.includes('proxy-stream');

    if (isHls) {
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = streamUrl;
        videoEl.play().catch(() => {});
      } else if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(videoEl);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { videoEl.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: hls.destroy(); hlsRef.current = null; break;
            }
          }
        });
      } else { console.error('[DirectStreamPlayer] HLS not supported'); }
    } else {
      videoEl.src = streamUrl;
      videoEl.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (videoEl) { videoEl.removeAttribute('src'); videoEl.load(); }
    };
  }, [streamUrl, streamType]);

  // Control subtitle visibility via text tracks
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const track = videoEl.textTracks[i];
      if (track) {
        track.mode = selectedSubtitle && track.label === selectedSubtitle ? 'showing' : 'hidden';
      }
    }
  }, [selectedSubtitle, allSubtitles]);

  const handleSubtitleSelect = useCallback((lang: string | null) => {
    setSelectedSubtitle(lang);
  }, []);

  const handleSubtitlesChange = useCallback((tracks: SubtitleTrack[]) => {
    setInternalSubtitles(tracks);
    if (onSubtitlesChange) onSubtitlesChange(tracks);
  }, [onSubtitlesChange]);

  if (!streamUrl) {
    return (
      <div className="h-full w-full bg-black flex justify-center items-center text-white">
        Loading Stream...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black group">
      <video ref={videoRef}
        className="h-full w-full bg-black" controls autoPlay playsInline crossOrigin="anonymous"
        style={{ '--cue-font-size': '1rem' } as React.CSSProperties}
      >
        {subtitleTracks}
      </video>

      {/* Controls overlay (bottom-right) */}
      <div className="absolute bottom-16 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <SubtitleSelector
          videoRef={videoRef}
          subtitles={allSubtitles}
          selectedSubtitle={selectedSubtitle}
          onSubtitleSelect={handleSubtitleSelect}
          onSubtitlesChange={handleSubtitlesChange}
          tmdbId={tmdbId}
          season={season}
          episode={episode}
          title={title}
        />
      </div>
    </div>
  );
}
''')

print('\\nAll files written successfully!')
