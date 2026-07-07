/** Free subtitle sources - no API keys needed */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mt = type === "movie" ? "movie" : "tv";
    const res = await fetch("https://api.themoviedb.org/3/" + mt + "/" + tmdbId + "?api_key=3fa2f58b01fc2153fe716cb40c39dddf", { signal: AbortSignal.timeout(6000) });
    if (!res.ok) { console.warn("[FreeSubs] TMDB lookup failed: " + res.status + " for " + tmdbId); return null; }
    const d = await res.json() as any;
    const id = d?.imdb_id || null;
    return id;
  } catch (e) { console.warn("[FreeSubs] TMDB lookup error:", e); return null; }
}

/**
 * Podnapisi subtitle scraper.
 * Parses the search results page and fetches download links.
 */
async function scrapePodnapisi(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const st = season ? "&sseason=" + season : "";
    const ep = episode ? "&sepisode=" + episode : "";
    const url = "https://www.podnapisi.net/subtitles/search/?sublanguage_id=en&imdb_id=" + imdbId + st + ep;
    console.log("[FreeSubs] Podnapisi URL: " + url);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn("[FreeSubs] Podnapisi failed: " + res.status); return []; }
    const html = await res.text();

    // Collect all subtitle rows from the table
    type Row = { lang: string; url: string };
    const rows: Row[] = [];

    // Try multiple regex patterns to handle different HTML structures
    const patterns = [
      // Pattern 1: <td class="lang">...</td> ... <a href="/subtitles/..." rel="nofollow">
      /<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\/td>[\s\S]*?<a[^>]*href="(\/[^"]+)"[^>]*rel="nofollow"[^>]*>/gi,
      // Pattern 2: Simpler link-based pattern
      /<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\/span>/gi,
      // Pattern 3: Broadest - any tr with a lang indicator
      /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>/gi,
    ];

    for (const pat of patterns) {
      let m;
      while ((m = pat.exec(html)) !== null) {
        const lang = (m[1] || m[2] || "").trim();
        const link = (m[2] || m[1] || "").trim();
        if (lang && link.startsWith("/")) {
          rows.push({ lang, url: "https://www.podnapisi.net" + link });
        }
      }
      if (rows.length > 0) break; // stop at first matching pattern
    }

    // Deduplicate by language
    const seen = new Set<string>();
    const unique = rows.filter(r => { const k = r.lang.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });

    if (unique.length === 0) {
      console.warn("[FreeSubs] Podnapisi: 0 subtitle rows for " + imdbId + " (html length: " + html.length + ")");
      return [];
    }

    // Fetch download pages in parallel batches (3 at a time)
    const final: SubtitleTrack[] = [];
    for (let i = 0; i < unique.length; i += 3) {
      const batch = unique.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(async (r) => {
        try {
          const dlRes = await fetch(r.url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(5000),
          });
          if (!dlRes.ok) return null;
          const dlHtml = await dlRes.text();
          // Look for download link
          const dlMatch = dlHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt))"[^>]*>/i);
          if (dlMatch) {
            const dlUrl = dlMatch[1].startsWith("http") ? dlMatch[1] : "https://www.podnapisi.net" + dlMatch[1];
            return {
              lang: r.lang,
              url: buildSubtitleProxyUrl(dlUrl),
              format: (dlMatch[2] === "vtt" ? "vtt" : "srt") as "vtt" | "srt",
              default: r.lang.toLowerCase() === "english",
            };
          }
          return null;
        } catch { return null; }
      }));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) final.push(r.value);
      }
    }

    console.log("[FreeSubs] Podnapisi: " + final.length + " tracks for " + imdbId);
    return final;
  } catch (e) { console.warn("[FreeSubs] Podnapisi error:", e); return []; }
}

export async function resolveFreeSubtitles(
  tmdbId: string, type: string, season?: number, episode?: number, imdbId?: string | null
): Promise<SubtitleTrack[]> {
  const imdb_id = imdbId || await tmdbToImdb(tmdbId, type);
  if (!imdb_id) { console.warn('[FreeSubs] No IMDB ID for ' + tmdbId); return []; }

  // NOTE: YIFY is movies-only, skip for TV shows
  const all: SubtitleTrack[] = [];

  // Podnapisi as primary free source
  const pod = await scrapePodnapisi(imdb_id, season, episode);
  all.push(...pod);

  console.log("[FreeSubs] Total: " + all.length + " tracks for " + tmdbId + " (Podnapisi=" + pod.length + ")");
  return all;
}
