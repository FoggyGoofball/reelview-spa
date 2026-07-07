import subprocess, sys

# ==========================================
# FIX 1: Video Overflow - CSS changes in Watch.tsx
# ==========================================
with open('spa/src/pages/Watch.tsx', 'r') as f:
    watch = f.read()

# overflow-hidden -> overflow-y-auto
watch = watch.replace(
    'className="h-screen w-screen bg-black overflow-hidden"',
    'className="h-screen w-screen bg-black overflow-y-auto"'
)
# flex-1 + min-h-0
watch = watch.replace(
    'className="flex-1 relative w-full"',
    'className="flex-1 relative w-full min-h-0"'
)
with open('spa/src/pages/Watch.tsx', 'w') as f:
    f.write(watch)
print('[1/5] Watch.tsx - overflow-y-auto + min-h-0')

# ==========================================
# FIX 2: Create subtitle-freestream.ts - free subtitle sources
# ==========================================
free_stream_code = r'''/** Free subtitle sources - no API keys needed */
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

/** Scrape YIFY subtitles (yifysubtitles.com) by IMDB ID */
async function scrapeYify(imdbId: string): Promise<SubtitleTrack[]> {
  try {
    const res = await fetch("https://yifysubtitles.com/movie/" + imdbId, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    // Match subtitle rows: <tr class="..."> <td class="lang">Arabic</td> ... href="/subtitles/english/12345"
    const re = /<tr[^>]*>.*?<td[^>]*>([^<]+)<\/td>.*?href="(\/subtitles\/[^"]+)"[^>]*>/gis;
    let m;
    while ((m = re.exec(html)) !== null) {
      const lang = m[1].trim();
      const subUrl = "https://yifysubtitles.com" + m[2];
      // YIFY requires a second request to get the actual .srt/.vtt download link
      try {
        const subRes = await fetch(subUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(5000),
        });
        if (!subRes.ok) continue;
        const subHtml = await subRes.text();
        // Find the download link: <a href="https://..." class="btn-icon download">Download</a>
        const dlMatch = subHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt|zip))"[^>]*>/i);
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

/** Try to find subtitles from podnapisi.net (free, no key) */
async function scrapePodnapisi(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const st = season ? "&sseason=" + season : "";
    const ep = episode ? "&sepisode=" + episode : "";
    const url = "https://www.podnapisi.net/subtitles/search/?sublanguage_id=en&imdb_id=" + imdbId + st + ep;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    // Match: <a href="/subtitles/en/..." class="subtitle-link">English</a>
    const re = /<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>([^<]+)<\/a>/gis;
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
        const dlMatch = dlHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt))"[^>]*>/i);
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

/** Main entry: try all free sources in parallel */
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
    f.write(free_stream_code)
print('[2/5] subtitle-freestream.ts created')

# ==========================================
# FIX 3: Update resolveSubtitles.ts to include free sources
# ==========================================
with open('spa/backend/src/routes/resolveSubtitles.ts', 'r') as f:
    resolve_ts = f.read()

# Add import for free subtitles
old_import = '''import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";
import { scrapeSubdl } from "../providers/subtitle-scraper.js";'''
new_import = '''import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";
import { scrapeSubdl } from "../providers/subtitle-scraper.js";
import { resolveFreeSubtitles } from "../providers/subtitle-freestream.js";'''
resolve_ts = resolve_ts.replace(old_import, new_import)

# Add free subtitles to the waterfall
old_waterfall = '''const [osT, subdlT] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),
  ]);'''
new_waterfall = '''const [osT, subdlT, freeT] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),
    resolveFreeSubtitles(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),
  ]);'''
resolve_ts = resolve_ts.replace(old_waterfall, new_waterfall)

# Update dedup to include freeT
old_dedup = '''for (const t of [...osT, ...subdlT])'''
new_dedup = '''for (const t of [...osT, ...subdlT, ...freeT])'''
resolve_ts = resolve_ts.replace(old_dedup, new_dedup)

with open('spa/backend/src/routes/resolveSubtitles.ts', 'w') as f:
    f.write(resolve_ts)
print('[3/5] resolveSubtitles.ts - added free subtitle sources')

# ==========================================
# FIX 4: Update direct-stream-player.tsx - extract embedded HLS subtitle tracks
# ==========================================
with open('spa/src/components/video/direct-stream-player.tsx', 'r') as f:
    dsp = f.read()

# After the HLS init effect, add a subtitle track extraction effect
# Find the subtitle selector line and add a useEffect before it that extracts embedded tracks
old_hls_init = '''  useEffect(() => { const el = vr.current; if (!el || !streamUrl) return; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream"); if (isHls) { if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = streamUrl; el.play().catch(() => {}); } else if (Hls.isSupported()) { const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 }); hlsRef.current = hls; hls.loadSource(streamUrl); hls.attachMedia(el); hls.on(Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}); }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { switch (d.type) { case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); hlsRef.current = null; } } }); } else { console.error("[DSP] HLS not supported"); } } else { el.src = streamUrl; el.play().catch(() => {}); } return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } if (el) { el.removeAttribute("src"); el.load(); } }; }, [streamUrl, streamType]);'''

# Insert a subtitle track extraction effect after the HLS effect
new_hls_init = '''  useEffect(() => { const el = vr.current; if (!el || !streamUrl) return; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream"); if (isHls) { if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = streamUrl; el.play().catch(() => {}); } else if (Hls.isSupported()) { const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 }); hlsRef.current = hls; hls.loadSource(streamUrl); hls.attachMedia(el); hls.on(Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}); }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { switch (d.type) { case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); hlsRef.current = null; } } }); } else { console.error("[DSP] HLS not supported"); } } else { el.src = streamUrl; el.play().catch(() => {}); } return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } if (el) { el.removeAttribute("src"); el.load(); } }; }, [streamUrl, streamType]);

  /** Extract embedded subtitle tracks from the video element after HLS loads */
  useEffect(() => {
    const el = vr.current;
    if (!el) return;
    const check = () => {
      if (el.textTracks.length > 0) {
        const embedded: SubtitleTrack[] = [];
        for (let i = 0; i < el.textTracks.length; i++) {
          const t = el.textTracks[i];
          if (t && t.label) {
            embedded.push({ lang: t.label, url: "", format: "vtt", default: t.language === "en" || i === 0 });
          }
        }
        if (embedded.length > 0) {
          setIntSubs(prev => {
            const existing = new Set(prev.map(s => s.lang.toLowerCase()));
            const newOnes = embedded.filter(s => !existing.has(s.lang.toLowerCase()));
            if (newOnes.length > 0) return [...prev, ...newOnes];
            return prev;
          });
        }
      }
    };
    // Check periodically for up to 10 seconds after loading
    const iv = setInterval(check, 1000);
    setTimeout(() => clearInterval(iv), 10000);
    return () => clearInterval(iv);
  }, [streamUrl]);'''

dsp = dsp.replace(old_hls_init, new_hls_init)

with open('spa/src/components/video/direct-stream-player.tsx', 'w') as f:
    f.write(dsp)
print('[4/5] direct-stream-player.tsx - embedded HLS subtitle extraction')

print()
print('[5/5] All changes applied successfully!')
