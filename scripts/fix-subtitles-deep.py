"""
Deep subtitle fix:
1. Simplify free scrapers - faster, more resilient
2. Add logging everywhere
3. Parse HLS manifest for real subtitle URLs
"""
import re

# ─── 1. Rewrite subtitle-freestream.ts to be faster ─────────────────────
free_ts = r'''/** Free subtitle sources - no API keys needed, simplified for speed */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mt = type === "movie" ? "movie" : "tv";
    const res = await fetch("https://api.themoviedb.org/3/" + mt + "/" + tmdbId + "?api_key=3fa2f58b01fc2153fe716cb40c39dddf", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) { console.warn("[FreeSubs] TMDB lookup failed: " + res.status + " for " + tmdbId); return null; }
    const d = await res.json() as any;
    const id = d?.imdb_id || null;
    console.log("[FreeSubs] TMDB " + tmdbId + " => IMDB " + (id || "null"));
    return id;
  } catch (e) { console.warn("[FreeSubs] TMDB lookup error:", e); return null; }
}

async function scrapeYifyFast(imdbId: string): Promise<SubtitleTrack[]> {
  try {
    const url = "https://yifysubtitles.com/movie/" + imdbId;
    console.log("[FreeSubs] Fetching YIFY list: " + url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn("[FreeSubs] YIFY list failed: " + res.status); return []; }
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    // Parse all download links directly from the list page
    const re = /<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const lang = m[2].trim();
      const subPath = m[1];
      const dlUrl = "https://yifysubtitles.com" + subPath;
      tracks.push({
        lang,
        url: dlUrl,
        format: "srt",
        default: lang.toLowerCase() === "english",
      });
    }
    // Filter unique by language
    const seen = new Set<string>();
    const unique = tracks.filter(t => { const k = t.lang.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    console.log("[FreeSubs] YIFY found " + unique.length + " unique languages for " + imdbId);
    // Now fetch download pages in parallel (batch of 3)
    const batchSize = 3;
    const final: SubtitleTrack[] = [];
    for (let i = 0; i < unique.length; i += batchSize) {
      const batch = unique.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(async (t) => {
        try {
          const subRes = await fetch(t.url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          if (!subRes.ok) return null;
          const subHtml = await subRes.text();
          const dlMatch = subHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt|zip))"[^>]*>/i);
          if (dlMatch) {
            let dlUrl = dlMatch[1];
            if (dlUrl.startsWith("/")) dlUrl = "https://yifysubtitles.com" + dlUrl;
            return { ...t, url: buildSubtitleProxyUrl(dlUrl), format: dlUrl.endsWith(".vtt") ? "vtt" : "srt" };
          }
          return null;
        } catch { return null; }
      }));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) final.push(r.value);
      }
    }
    console.log("[FreeSubs] YIFY final: " + final.length + " tracks");
    return final;
  } catch (e) { console.warn("[FreeSubs] YIFY error:", e); return []; }
}

async function scrapePodnapisiFast(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const st = season ? "&sseason=" + season : "";
    const ep = episode ? "&sepisode=" + episode : "";
    const url = "https://www.podnapisi.net/subtitles/search/?sublanguage_id=en&imdb_id=" + imdbId + st + ep;
    console.log("[FreeSubs] Fetching Podnapisi: " + url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn("[FreeSubs] Podnapisi failed: " + res.status); return []; }
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    const re = /<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\/td>.*?<a[^>]*href="(\/[^"]+)"[^>]*rel="nofollow"[^>]*>/gis;
    let m;
    while ((m = re.exec(html)) !== null) {
      const lang = m[1].trim();
      const subPath = m[2];
      tracks.push({
        lang,
        url: "https://www.podnapisi.net" + subPath,
        format: "srt",
        default: lang.toLowerCase() === "english",
      });
    }
    const seen = new Set<string>();
    const unique = tracks.filter(t => { const k = t.lang.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    console.log("[FreeSubs] Podnapisi found " + unique.length + " unique for " + imdbId);
    // Fetch download pages in parallel batches
    const final: SubtitleTrack[] = [];
    for (let i = 0; i < unique.length; i += 3) {
      const batch = unique.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(async (t) => {
        try {
          const dlRes = await fetch(t.url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          if (!dlRes.ok) return null;
          const dlHtml = await dlRes.text();
          const dlMatch = dlHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt))"[^>]*>/i);
          if (dlMatch) {
            const dlUrl = dlMatch[1].startsWith("http") ? dlMatch[1] : "https://www.podnapisi.net" + dlMatch[1];
            return { ...t, url: buildSubtitleProxyUrl(dlUrl), format: dlMatch[2] === "vtt" ? "vtt" : "srt" };
          }
          return null;
        } catch { return null; }
      }));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) final.push(r.value);
      }
    }
    console.log("[FreeSubs] Podnapisi final: " + final.length + " tracks");
    return final;
  } catch (e) { console.warn("[FreeSubs] Podnapisi error:", e); return []; }
}

export async function resolveFreeSubtitles(
  tmdbId: string, type: string, season?: number, episode?: number
): Promise<SubtitleTrack[]> {
  const imdbId = await tmdbToImdb(tmdbId, type);
  if (!imdbId) return [];
  const [yify, pod] = await Promise.all([
    scrapeYifyFast(imdbId),
    scrapePodnapisiFast(imdbId, season, episode),
  ]);
  const all = [...yify, ...pod];
  console.log("[FreeSubs] Total: " + all.length + " tracks for " + tmdbId + " (YIFY=" + yify.length + ", Podnapisi=" + pod.length + ")");
  return all;
}
'''

with open('spa/backend/src/providers/subtitle-freestream.ts', 'w', encoding='utf-8') as f:
    f.write(free_ts)
print('[1] Updated subtitle-freestream.ts - faster batch processing + logging')

# ─── 2. Add logging to resolveSubtitles.ts ──────────────────────────────

with open('spa/backend/src/routes/resolveSubtitles.ts', 'r', encoding='utf-8') as f:
    rs = f.read()

# Replace with verbose version
rs_new = rs.replace(
    "const [osT, subdlT, freeT] = await Promise.all([\n    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),\n    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n    resolveFreeSubtitles(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n  ]);",
    "const [osT, subdlT, freeT] = await Promise.all([\n    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => { console.warn('[ResolveSubtitles] OpenSubtitles failed for ' + tmdbId); return [] as SubtitleTrack[]; }),\n    scrapeSubdl(tmdbId, type, s, e).catch(() => { console.warn('[ResolveSubtitles] Subdl failed for ' + tmdbId); return [] as SubtitleTrack[]; }),\n    resolveFreeSubtitles(tmdbId, type, s, e).catch(() => { console.warn('[ResolveSubtitles] Free failed for ' + tmdbId); return [] as SubtitleTrack[]; }),\n  ]);"
)
rs_new = rs_new.replace(
    "console.log(\"[ResolveSubtitles] Found \" + dedup.size + \" tracks for \" + tmdbId);",
    "console.log('[ResolveSubtitles] Found ' + dedup.size + ' tracks for ' + tmdbId + ' (OS=' + osT.length + ', Subdl=' + subdlT.length + ', Free=' + freeT.length + ')');"
)

with open('spa/backend/src/routes/resolveSubtitles.ts', 'w', encoding='utf-8') as f:
    f.write(rs_new)
print('[2] Updated resolveSubtitles.ts - per-provider logging')

# ─── 3. Add full response logging to subtitle-selector.tsx ──────────────

with open('spa/src/components/video/subtitle-selector.tsx', 'r', encoding='utf-8') as f:
    ss = f.read()

# Replace the handleSearch to log the raw response
old_search = """  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title }) }); const d = await r.json(); if (d.success && d.subtitles?.length > 0) { onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } } catch (e) { console.error('[SubSearch] Failed:', e); } finally { setResolving(false); } }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);"""

new_search = """  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { console.log('[SubSearch] Fetching subtitles for tmdbId=' + tmdbId + ' S=' + season + ' E=' + episode); const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title }) }); console.log('[SubSearch] Response status: ' + r.status); const d = await r.json(); console.log('[SubSearch] Response body:', JSON.stringify(d)); if (d.success && d.subtitles?.length > 0) { console.log('[SubSearch] Got ' + d.subtitles.length + ' tracks, setting...'); onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } else { console.warn('[SubSearch] No subtitles returned: success=' + d.success + ' subtitles=' + (d.subtitles?.length ?? 'undefined')); } } catch (e) { console.error('[SubSearch] Failed:', e); } finally { setResolving(false); } }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);"""

ss = ss.replace(old_search, new_search)
with open('spa/src/components/video/subtitle-selector.tsx', 'w', encoding='utf-8') as f:
    f.write(ss)
print('[3] Updated subtitle-selector.tsx - full response logging')

# ─── 4. Add HLS manifest subtitle URL extraction to direct-stream-player.tsx ──

with open('spa/src/components/video/direct-stream-player.tsx', 'r', encoding='utf-8') as f:
    dsp = f.read()

# Add HLS subtitle URL extraction after the existing HLS textTrack extraction
old_hls_block = """  /** Extract embedded subtitle tracks from HLS manifest after loading */
  useEffect(() => {
    const el = vr.current;
    if (!el) return;
    let attempts = 0;
    const check = () => {
      attempts++;
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
    const iv = setInterval(check, 800);
    setTimeout(() => clearInterval(iv), 8000);
    return () => clearInterval(iv);
  }, [streamUrl]);"""

new_hls_block = """  /** Extract embedded subtitle tracks from HLS manifest after loading */
  useEffect(() => {
    const el = vr.current;
    if (!el) return;
    let attempts = 0;
    const check = () => {
      attempts++;
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
            if (newOnes.length > 0) {
              console.log('[DSP] Found ' + newOnes.length + ' embedded textTracks: ' + newOnes.map(s => s.lang).join(', '));
              return [...prev, ...newOnes];
            }
            return prev;
          });
        }
      }
    };
    const iv = setInterval(check, 800);
    setTimeout(() => clearInterval(iv), 8000);
    return () => clearInterval(iv);
  }, [streamUrl]);

  /** Parse HLS master manifest for real subtitle .vtt URLs */
  useEffect(() => {
    const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream");
    if (!isHls || !streamUrl) return;
    let cancelled = false;
    const fetchManifest = async () => {
      try {
        console.log('[DSP] Fetching HLS manifest for subtitle URLs: ' + streamUrl);
        const res = await fetch(streamUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) { console.warn('[DSP] Manifest fetch failed: ' + res.status); return; }
        const text = await res.text();
        console.log('[DSP] Manifest response (' + text.length + ' bytes)');
        // Parse for EXT-X-MEDIA:TYPE=SUBTITLES
        // Format: #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs_en.m3u8"
        const subRe = /#EXT-X-MEDIA:TYPE=SUBTITLES[^]*?URI="([^"]+)"/g;
        const langRe = /NAME="([^"]+)"/g;
        const langRe2 = /LANGUAGE="([^"]+)"/g;
        const subs: SubtitleTrack[] = [];
        let match;
        // Reset lastIndex
        subRe.lastIndex = 0;
        let lastName = '';
        let urlMatch;
        while ((urlMatch = subRe.exec(text)) !== null) {
          const fullMatch = urlMatch[0];
          const uri = urlMatch[1];
          const nameMatch = fullMatch.match(/NAME="([^"]+)"/);
          const langMatch = fullMatch.match(/LANGUAGE="([^"]+)"/);
          const name = nameMatch ? nameMatch[1] : (langMatch ? langMatch[1] : 'Unknown');
          subs.push({
            lang: name,
            url: resolveUrl(uri, streamUrl),
            format: "vtt",
            default: name.toLowerCase().includes('english') || name.toLowerCase().includes('en'),
          });
        }
        if (subs.length > 0) {
          console.log('[DSP] Parsed ' + subs.length + ' subtitle tracks from manifest: ' + subs.map(s => s.lang).join(', '));
          setIntSubs(prev => {
            const existing = new Set(prev.map(s => s.lang.toLowerCase()));
            const newOnes = subs.filter(s => !existing.has(s.lang.toLowerCase()));
            if (newOnes.length > 0) return [...prev, ...newOnes];
            return prev;
          });
        } else {
          console.log('[DSP] No EXT-X-MEDIA:SUBTITLES found in manifest');
        }
      } catch (e) {
        console.warn('[DSP] HLS manifest subtitle parsing error:', e);
      }
    };
    // Small delay to let HLS.js process first
    const timeout = setTimeout(fetchManifest, 2000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [streamUrl, streamType]);

/** Resolve a relative URI against a base URL */
function resolveUrl(uri: string, base: string): string {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try {
    const baseUrl = new URL(base);
    // If URI is absolute path, use origin
    if (uri.startsWith('/')) return baseUrl.origin + uri;
    // Otherwise resolve relative to base
    return new URL(uri, base).href;
  } catch {
    // Fallback: try to use the base URL's directory
    const lastSlash = base.lastIndexOf('/');
    if (lastSlash > 0) return base.substring(0, lastSlash + 1) + uri;
    return uri;
  }
}"""

dsp = dsp.replace(old_hls_block, new_hls_block)
with open('spa/src/components/video/direct-stream-player.tsx', 'w', encoding='utf-8') as f:
    f.write(dsp)
print('[4] Updated direct-stream-player.tsx - HLS manifest subtitle URL extraction')

print()
print('=== All fixes applied. Rebuild and deploy. ===')
