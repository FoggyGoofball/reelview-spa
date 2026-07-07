/** Free subtitle sources - no API keys needed, simplified for speed */
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
  tmdbId: string, type: string, season?: number, episode?: number, imdbId?: string | null
): Promise<SubtitleTrack[]> {
  const imdb_id = imdbId || await tmdbToImdb(tmdbId, type);
  if (!imdb_id) { console.warn('[FreeSubs] No IMDB ID for ' + tmdbId); return []; }
  const [yify, pod] = await Promise.all([
    scrapeYifyFast(imdb_id),
    scrapePodnapisiFast(imdb_id, season, episode),
  ]);
  const all = [...yify, ...pod];
  console.log("[FreeSubs] Total: " + all.length + " tracks for " + tmdbId + " (YIFY=" + yify.length + ", Podnapisi=" + pod.length + ")");
  return all;
}
