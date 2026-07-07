/** Free subtitle sources - no API keys needed */
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
    const re = /<tr[^>]*>.*?<td[^>]*>([^<]+)<\/td>.*?href="(\/subtitles\/[^"]+)"[^>]*>/gis;
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
