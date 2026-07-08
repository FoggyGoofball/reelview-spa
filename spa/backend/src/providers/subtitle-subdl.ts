/**
 * Subdl.com subtitle scraper
 * 
 * URL patterns discovered:
 * - Search: https://subdl.com/?s={query}
 * - Show page: https://subdl.com/subtitle/{slug}/{show-name}
 * - Download: https://dl.subdl.com/subtitle/{bucketLink}
 * 
 * The search page contains __NEXT_DATA__ JSON with subtitle metadata
 */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

interface SubdlSubtitle {
  id: number;
  language: string;
  quality: string;
  link: string;
  bucketLink: string;
  season: number;
  episode: number;
  title: string;
  downloads: number;
}

interface SubdlMovie {
  type: string;
  name: string;
  year: number;
  link: string;
  slug: string;
}

/**
 * Get show name from TMDB ID
 */
async function tmdbToShowName(tmdbId: string, type: string): Promise<string | null> {
  try {
    const mediaType = type === "movie" ? "movie" : "tv";
    const res = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=3fa2f58b01fc2153fe716cb40c39dddf`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data?.name || data?.title || null;
  } catch {
    return null;
  }
}

/**
 * Search Subdl and extract subtitle data from __NEXT_DATA__ JSON
 */
async function searchSubdl(showName: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {
  try {
    const searchUrl = `https://subdl.com/?s=${encodeURIComponent(showName)}`;
    console.log("[Subdl] Searching:", showName);
    
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!res.ok) {
      console.warn("[Subdl] Search failed:", res.status);
      return [];
    }
    
    const html = await res.text();
    
    // Extract __NEXT_DATA__ JSON
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) {
      console.warn("[Subdl] Could not find __NEXT_DATA__");
      return [];
    }
    
    let nextData;
    try {
      nextData = JSON.parse(nextDataMatch[1]);
    } catch (e) {
      console.warn("[Subdl] Failed to parse __NEXT_DATA__:", e);
      return [];
    }
    
    // Extract popular subtitles from the data
    const popularSubtitles = nextData?.props?.pageProps?.popularSubtitles || [];
    if (!Array.isArray(popularSubtitles)) {
      console.warn("[Subdl] No popularSubtitles found");
      return [];
    }
    
    // Filter for matching show and episode
    const showNameLower = showName.toLowerCase();
    const tracks: SubtitleTrack[] = [];
    
    for (const item of popularSubtitles) {
      const movie: SubdlMovie = item.movie;
      const subtitle: SubdlSubtitle = item.subtitle;
      
      if (!movie || !subtitle) continue;
      
      // Check if this matches our show
      if (!movie.name.toLowerCase().includes(showNameLower) && 
          !showNameLower.includes(movie.name.toLowerCase())) {
        continue;
      }
      
      // For TV shows, check season/episode match
      if (movie.type === "tv" && season && episode) {
        // Subdl uses season=0 for "all seasons" sometimes
        if (subtitle.season !== 0 && subtitle.season !== season) continue;
        if (subtitle.episode !== 0 && subtitle.episode !== episode) continue;
      }
      
      // Build download URL
      // Format: https://dl.subdl.com/subtitle/{bucketLink}
      const downloadUrl = `https://dl.subdl.com/subtitle/${subtitle.bucketLink}`;
      
      // Normalize language name
      let lang = subtitle.language || "Unknown";
      lang = lang.charAt(0).toUpperCase() + lang.slice(1);
      
      tracks.push({
        lang,
        url: buildSubtitleProxyUrl(downloadUrl),
        format: "srt", // Subdl provides zip files containing srt
        default: lang.toLowerCase() === "english",
      });
      
      console.log("[Subdl] Found:", lang, subtitle.title, downloadUrl);
    }
    
    // Deduplicate by language
    const seen = new Set<string>();
    const unique = tracks.filter(t => {
      const key = t.lang.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log("[Subdl] Total unique tracks:", unique.length);
    return unique;
  } catch (e) {
    console.warn("[Subdl] Error:", e);
    return [];
  }
}

/**
 * Main entry point: resolve subtitles from Subdl
 */
export async function scrapeSubdlNew(
  tmdbId: string, 
  type: string, 
  season?: number, 
  episode?: number
): Promise<SubtitleTrack[]> {
  try {
    // Get show name from TMDB
    const showName = await tmdbToShowName(tmdbId, type);
    if (!showName) {
      console.warn("[Subdl] Could not get show name for TMDB ID:", tmdbId);
      return [];
    }
    
    console.log("[Subdl] Looking up:", showName, type === "tv" ? `S${season}E${episode}` : "");
    
    // Search and extract subtitles
    return await searchSubdl(showName, season, episode);
  } catch (e) {
    console.warn("[Subdl] Error:", e);
    return [];
  }
}