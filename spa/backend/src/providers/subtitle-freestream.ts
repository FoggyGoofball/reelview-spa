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
 * Podnapisi — fully rewritten with a catch-all HTML scraper.
 * Dumps first 2KB of HTML on failure so we can debug.
 */
async function scrapePodnapisi(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const params = new URLSearchParams({ sublanguage_id: "en", imdb_id: imdbId.replace("tt", "") });
    if (season) params.set("sseason", String(season));
    if (episode) params.set("sepisode", String(episode));
    const url = "https://www.podnapisi.net/subtitles/search/?" + params.toString();
    console.log("[FreeSubs] Podnapisi URL: " + url);
    
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) { console.warn("[FreeSubs] Podnapisi failed: " + res.status); return []; }
    const html = await res.text();

    // Debug: dump raw HTML sample
    const debug = html.slice(0, 1500);
    console.log("[FreeSubs] Podnapisi HTML raw (" + html.length + "b): " + debug);

    // Catch-all: find all links that look like subtitle detail pages
    const rows: Array<{ lang: string; url: string }> = [];
    
    // Pattern: any <a href="/subtitles/.../"> containing language text near it
    const linkRe = /<a[^>]*href="(\/subtitles\/[^"]+)"[^>]*>([\s\S]{0,200})<\/a>/gi;
    let m;
    while ((m = linkRe.exec(html)) !== null) {
      const href = m[1];
      const context = m[2].toLowerCase();
      // Extract language from context (usually the first word before <br> or similar)
      const cleaned = m[2].replace(/<[^>]+>/g, " ").trim();
      if (cleaned && cleaned.length < 50 && !/^\d/.test(cleaned)) {
        rows.push({ lang: cleaned, url: "https://www.podnapisi.net" + href });
      }
    }

    // Also try extracting subtitle rows from <tr> elements
    if (rows.length === 0) {
      console.warn("[FreeSubs] Podnapisi link-based parse found 0 rows, trying tr-based...");
      const trRe = /<tr[^>]*>([\s\S]{0,2000}?)<\/tr>/gi;
      let trm;
      while ((trm = trRe.exec(html)) !== null) {
        const tr = trm[1];
        // Look for language within the row
        const langMatch = tr.match(/<td[^>]*>([A-Za-z\s]{2,30})<\/td>/);
        const linkMatch = tr.match(/href="(\/subtitles\/[^"]+)"/);
        if (langMatch && linkMatch) {
          const lang = langMatch[1].trim();
          if (lang && lang.length < 30 && !/^\d/.test(lang)) {
            rows.push({ lang, url: "https://www.podnapisi.net" + linkMatch[1] });
          }
        }
      }
    }

    // Last resort: find any link with "subtitles" in path
    if (rows.length === 0) {
      const broadRe = /href="(\/subtitles\/[^"]+)"[^>]*>([^<]{2,50})<\/a>/gi;
      while ((m = broadRe.exec(html)) !== null) {
        rows.push({ lang: m[2].trim(), url: "https://www.podnapisi.net" + m[1] });
      }
    }

    if (rows.length === 0) {
      console.warn("[FreeSubs] Podnapisi: 0 rows found for " + imdbId + " (html=" + html.length + " bytes)");
      return [];
    }

    // Deduplicate by language
    const seen = new Set<string>();
    const unique = rows.filter(r => { const k = r.lang.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    console.log("[FreeSubs] Podnapisi: " + unique.length + " unique rows found");

    // Fetch download pages in batches of 3
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
          // Look for download link - try both full URL and relative
          let dlMatch = dlHtml.match(/<a[^>]*href="([^"]+\.(srt|vtt|sub))"[^>]*>/i);
          if (!dlMatch) dlMatch = dlHtml.match(/href="(\/download\/[^"]+\.(srt|vtt|sub))"/i);
          if (dlMatch) {
            const dlUrl = dlMatch[1].startsWith("http") ? dlMatch[1] : "https://www.podnapisi.net" + dlMatch[1];
            const fmt = (dlMatch[2] || "srt").toLowerCase();
            return {
              lang: r.lang,
              url: buildSubtitleProxyUrl(dlUrl),
              format: (fmt === "vtt" ? "vtt" : "srt") as "vtt" | "srt",
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

/**
 * TVSubtitles.net scraper — direct subtitle file links by IMDB ID.
 * URL format: https://www.tvsubtitles.net/tvshow-IMDBID.html
 * Where IMDBID is the numeric part of the IMDB ID.
 */
async function scrapeTVSubtitles(imdbId: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const numericId = imdbId.replace("tt", "");
    // Try both episode-level and show-level URLs
    const urls: string[] = [];
    
    // Episode-level: /episode-IMDBID-SS-EE.html  
    if (season && episode) {
      urls.push("https://www.tvsubtitles.net/episode-" + numericId + "-" + season + "-" + episode + ".html");
    }
    // Show-level: /tvshow-IMDBID-1.html
    urls.push("https://www.tvsubtitles.net/tvshow-" + numericId + "-1.html");
    
    for (const url of urls) {
      console.log("[FreeSubs] TVSubtitles URL: " + url);
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 200) {
        const html = await res.text();
        const debug = html.slice(0, 1200);
        console.log("[FreeSubs] TVSubtitles HTML raw: " + debug);
        
        // Look for subtitle download links (.srt, .zip)
        const tracks: SubtitleTrack[] = [];
        const re = /<a[^>]*href="([^"]+\.(?:srt|zip))"[^>]*>([^<]{1,100})<\/a>/gi;
        let m;
        while ((m = re.exec(html)) !== null) {
          const href = m[1];
          const label = m[2].trim();
          let lang = "Unknown";
          // Try to extract language from context
          const before = html.slice(Math.max(0, m.index - 200), m.index);
          const langMatch = before.match(/(?:English|Spanish|French|German|Italian|Portuguese|Dutch|Polish|Arabic|Hindi|Chinese|Japanese|Korean|Russian|Turkish)/i);
          if (langMatch) lang = langMatch[0];
          
          const dlUrl = href.startsWith("http") ? href : "https://www.tvsubtitles.net" + href;
          tracks.push({
            lang,
            url: buildSubtitleProxyUrl(dlUrl),
            format: (m[2].toLowerCase() === "vtt" ? "vtt" : "srt") as "vtt" | "srt",
          });
        }
        if (tracks.length > 0) {
          console.log("[FreeSubs] TVSubtitles: " + tracks.length + " tracks");
          return tracks;
        }
      }
    }
    console.warn("[FreeSubs] TVSubtitles: 0 results");
    return [];
  } catch (e) { console.warn("[FreeSubs] TVSubtitles error:", e); return []; }
}

/**
 * TheSubDB API — free, no API key needed.
 * GET http://api.thesubdb.com/?action=search&hash=<hash>
 * Only works with movie file hashes, so limited use.
 * 
 * Instead, use the SubDB search: http://thesubdb.com/api/
 */

/**
 * Addic7ed-style scraper via https://www.opensubtitles.org API.
 * We'll skip this since it requires login/captcha often.
 */

export async function resolveFreeSubtitles(
  tmdbId: string, type: string, season?: number, episode?: number, imdbId?: string | null
): Promise<SubtitleTrack[]> {
  const imdb_id = imdbId || await tmdbToImdb(tmdbId, type);
  if (!imdb_id) { console.warn('[FreeSubs] No IMDB ID for ' + tmdbId); return []; }

  const all: SubtitleTrack[] = [];

  // Try multiple free sources in parallel
  const [pod, tvsubs] = await Promise.all([
    scrapePodnapisi(imdb_id, season, episode).catch(() => [] as SubtitleTrack[]),
    scrapeTVSubtitles(imdb_id, season, episode).catch(() => [] as SubtitleTrack[]),
  ]);
  all.push(...pod, ...tvsubs);

  // Deduplicate by language
  const dd = new Map<string, SubtitleTrack>();
  for (const t of all) { if (!dd.has(t.lang.toLowerCase())) dd.set(t.lang.toLowerCase(), t); }
  const final = Array.from(dd.values());

  console.log("[FreeSubs] Total: " + final.length + " tracks for " + tmdbId + " (Podnapisi=" + pod.length + ", TVSubtitles=" + tvsubs.length + ")");
  return final;
}
