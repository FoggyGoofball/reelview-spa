/** Subdl scraper - no API key needed */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";
async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mt = type === "movie" ? "movie" : "tv";
    const res = await fetch("https://api.themoviedb.org/3/" + mt + "/" + tmdbId + "?api_key=3a4d5d2a9f5e4c8b8a7f6e5d4c3b2a1f", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const d = await res.json() as any;
    return d?.imdb_id || null;
  } catch { return null; }
}
export async function scrapeSubdl(tmdbId: string, type: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const imdbId = await tmdbToImdb(tmdbId, type);
    if (!imdbId) return [];
    const url = type === "movie" ? "https://subdl.com/subtitle/" + imdbId : "https://subdl.com/s/subtitle/" + imdbId + "/" + season + "/" + episode;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    const re = /<tr[^>]*>.*?<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\/td>.*?<td[^>]*class="[^"]*format[^"]*"[^>]*>\.?([^<]+)<\/td>.*?<a[^>]*href="(\/download\/[^"]+)"[^>]*>/gis;
    let m; while ((m = re.exec(html)) !== null) {
      tracks.push({ lang: m[1].trim(), url: buildSubtitleProxyUrl("https://subdl.com" + m[3]), format: m[2].trim().toLowerCase().includes("vtt") ? "vtt" : "srt", default: m[1].trim().toLowerCase() === "english" });
    }
    return tracks;
  } catch { return []; }
}
