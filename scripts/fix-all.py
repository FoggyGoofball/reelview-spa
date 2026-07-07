import subprocess, sys

# FIX 1: Video Overflow - CSS changes in Watch.tsx
with open('spa/src/pages/Watch.tsx', 'r') as f:
    watch = f.read()
watch = watch.replace(
    'className="h-screen w-screen bg-black overflow-hidden"',
    'className="h-screen w-screen bg-black overflow-y-auto"'
)
watch = watch.replace(
    'className="flex-1 relative w-full"',
    'className="flex-1 relative w-full min-h-0"'
)
with open('spa/src/pages/Watch.tsx', 'w') as f:
    f.write(watch)
print('[1] Watch.tsx updated')

# FIX 2: Create subtitle-freestream.ts
code = '''/** Free subtitle sources - no API keys needed */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mt = type === "movie" ? "movie" : "tv";
    const res = await fetch("https://api.themoviedb.org/3/" + mt + "/" + tmdbId + "?api_key=3fa2f58b01fc2153fe716cb40c39dddf", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = await res.json() as any;
    return d?.imdb_id || null;
  } catch { return null; }
}

async function scrapeYify(imdbId: string): Promise<SubtitleTrack[]> {
  try {
    const res = await fetch("https://yifysubtitles.com/movie/" + imdbId, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    const re = /<tr[^>]*>.*?<td[^>]*>([^<]+)<\\/td>.*?href="(\\/subtitles\\/[^"]+)"[^>]*>/gis;
    let m;
    while ((m = re.exec(html)) !== null) {
      const lang = m[1].trim();
      const subUrl = "https://yifysubtitles.com" + m[2];
      try {
        const subRes = await fetch(subUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!subRes.ok) continue;
        const subHtml = await subRes.text();
        const dlMatch = subHtml.match(/<a[^>]*href="([^"]+\\.(srt|vtt|zip))"[^>]*>/i);
        if (dlMatch) {
          let dlUrl = dlMatch[1];
          if (dlUrl.startsWith("/")) dlUrl = "https://yifysubtitles.com" + dlUrl;
          const fmt = dlUrl.endsWith(".vtt") ? "vtt" : "srt";
          tracks.push({
            lang,
            url: buildSubtitleProxyUrl(dlUrl),
            format: fmt,
            default: lang.toLowerCase() === "english",
          });
        }
      } catch { continue; }
    }
    return tracks;
  } catch { return []; }
}

async function scrapePodnapisi(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const st = season ? "&sseason=" + season : "";
    const ep = episode ? "&sepisode=" + episode : "";
    const url = "https://www.podnapisi.net/subtitles/search/?sublanguage_id=en&imdb_id=" + imdbId + st + ep;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    const re = /<a[^>]*href="(\\/subtitles\\/[^"]+)"[^>]*>([^<]+)<\\/a>/gis;
    let m;
    while ((m = re.exec(html)) !== null) {
      const subPath = m[1];
      const lang = m[2].trim();
      try {
        const dlRes = await fetch("https://www.podnapisi.net" + subPath, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(5000),
        });
        if (!dlRes.ok) continue;
        const dlHtml = await dlRes.text();
        const dlMatch = dlHtml.match(/<a[^>]*href="([^"]+\\.(srt|vtt))"[^>]*>/i);
        if (dlMatch) {
          const url = dlMatch[1].startsWith("http") ? dlMatch[1] : "https://www.podnapisi.net" + dlMatch[1];
          tracks.push({
            lang,
            url: buildSubtitleProxyUrl(url),
            format: dlMatch[2] === "vtt" ? "vtt" : "srt",
            default: lang.toLowerCase() === "english",
          });
        }
      } catch { continue; }
    }
    return tracks;
  } catch { return []; }
}

export async function resolveFreeSubtitles(
  tmdbId: string, type: string, season?: number, episode?: number
): Promise<SubtitleTrack[]> {
  const imdbId = await tmdbToImdb(tmdbId, type);
  if (!imdbId) return [];
  const results = await Promise.allSettled([
    scrapeYify(imdbId),
    scrapePodnapisi(imdbId, season, episode),
  ]);
  const tracks: SubtitleTrack[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") tracks.push(...r.value);
  }
  return tracks;
}
'''

with open('spa/backend/src/providers/subtitle-freestream.ts', 'w') as f:
    f.write(code)
print('[2] subtitle-freestream.ts created')

# FIX 3: Update resolveSubtitles.ts
with open('spa/backend/src/routes/resolveSubtitles.ts', 'r') as f:
    ts = f.read()
ts = ts.replace(
    'import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";\nimport { scrapeSubdl } from "../providers/subtitle-scraper.js";',
    'import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";\nimport { scrapeSubdl } from "../providers/subtitle-scraper.js";\nimport { resolveFreeSubtitles } from "../providers/subtitle-freestream.js";'
)
ts = ts.replace(
    'const [osT, subdlT] = await Promise.all([\n    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),\n    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n  ]);',
    'const [osT, subdlT, freeT] = await Promise.all([\n    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),\n    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n    resolveFreeSubtitles(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n  ]);'
)
ts = ts.replace(
    'for (const t of [...osT, ...subdlT])',
    'for (const t of [...osT, ...subdlT, ...freeT])'
)
with open('spa/backend/src/routes/resolveSubtitles.ts', 'w') as f:
    f.write(ts)
print('[3] resolveSubtitles.ts updated')

# FIX 4: Embedded HLS subtitle extraction in direct-stream-player.tsx
# (Handled separately to avoid string escaping issues)
print('[4] direct-stream-player.tsx - SKIPPED for now (inline edit)')
print()
print('Done with fixes 1-3. Fix 4 (DSP) needs inline edit.')
