/**
 * Subdl.com subtitle scraper
 * 
 * URL patterns discovered:
 * - Show page: https://subdl.com/subtitle/{sd_id}/{slug}
 * - Season page: https://subdl.com/subtitle/{sd_id}/{slug}/season-{n}
 * - Next.js data: https://subdl.com/_next/data/{buildId}/subtitle/{sd_id}/{slug}/season-{n}.json
 * - Download: https://dl.subdl.com/subtitle/{bucketLink}
 * 
 * The season page contains groupedSubtitles organized by language
 */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

// Known show mappings (sd_id -> slug)
// This can be expanded or fetched from a remote source
const KNOWN_SHOWS: Record<string, { sdId: string; slug: string }> = {
  "game of thrones": { sdId: "sd1300025", slug: "game-of-thrones" },
  "breaking bad": { sdId: "sd1300026", slug: "breaking-bad" },
  "the big bang theory": { sdId: "sd1300027", slug: "the-big-bang-theory" },
  "friends": { sdId: "sd1300028", slug: "friends" },
  "house of the dragon": { sdId: "sd158091", slug: "house-of-the-dragon" },
  "stranger things": { sdId: "sd1300029", slug: "stranger-things" },
  "the walking dead": { sdId: "sd1300030", slug: "the-walking-dead" },
  "better call saul": { sdId: "sd1300031", slug: "better-call-saul" },
  "westworld": { sdId: "sd1300032", slug: "westworld" },
  "the crown": { sdId: "sd1300033", slug: "the-crown" },
};

// Current build ID (may need to be updated periodically)
const BUILD_ID = "FwUz2H0qIariWVjLvnGxK";

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
  hi: number;
  releases?: string[];
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
 * Try to find show info by searching Subdl
 */
async function findShowInfo(showName: string): Promise<{ sdId: string; slug: string } | null> {
  // First check known shows
  const knownShow = KNOWN_SHOWS[showName.toLowerCase()];
  if (knownShow) {
    console.log("[Subdl] Found in known shows:", showName);
    return knownShow;
  }

  // Try to search and extract from HTML
  try {
    const searchUrl = `https://subdl.com/?s=${encodeURIComponent(showName)}`;
    console.log("[Subdl] Searching for show info:", searchUrl);
    
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,*/*",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Look for subtitle links that contain the show name
    // Pattern: /subtitle/{sd_id}/{slug}
    const slugPattern = new RegExp(`/subtitle/(sd\\d+)/([a-z0-9-]+)`, "gi");
    const matches = [...html.matchAll(slugPattern)];
    
    if (matches.length > 0) {
      // Find the most common slug that matches the show name
      const showNameLower = showName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      for (const match of matches) {
        const sdId = match[1];
        const slug = match[2];
        if (slug.includes(showNameLower) || showNameLower.includes(slug)) {
          console.log("[Subdl] Found show info from search:", sdId, slug);
          return { sdId, slug };
        }
      }
      // Return first match if no exact match
      const firstMatch = matches[0];
      console.log("[Subdl] Using first match:", firstMatch[1], firstMatch[2]);
      return { sdId: firstMatch[1], slug: firstMatch[2] };
    }
  } catch (e) {
    console.warn("[Subdl] Search error:", e);
  }
  
  return null;
}

/**
 * Fetch subtitles from season-specific Next.js data route
 */
async function fetchSeasonSubtitles(
  sdId: string, 
  slug: string, 
  season: number, 
  episode?: number
): Promise<SubtitleTrack[]> {
  try {
    const dataUrl = `https://subdl.com/_next/data/${BUILD_ID}/subtitle/${sdId}/${slug}/season-${season}.json`;
    console.log("[Subdl] Fetching season data:", dataUrl);
    
    const res = await fetch(dataUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(30000), // Longer timeout for large responses
    });
    
    if (!res.ok) {
      console.warn("[Subdl] Season data fetch failed:", res.status);
      return [];
    }
    
    const data = await res.json() as any;
    const groupedSubtitles = data?.pageProps?.groupedSubtitles;
    
    if (!groupedSubtitles || typeof groupedSubtitles !== "object") {
      console.warn("[Subdl] No groupedSubtitles found");
      return [];
    }
    
    const tracks: SubtitleTrack[] = [];
    
    // Iterate through languages
    for (const [language, subtitles] of Object.entries(groupedSubtitles)) {
      if (!Array.isArray(subtitles)) continue;
      
      for (const sub of subtitles as SubdlSubtitle[]) {
        // Filter by episode if specified
        if (episode && sub.episode !== 0 && sub.episode !== episode) continue;
        
        // Build download URL
        const downloadUrl = `https://dl.subdl.com/subtitle/${sub.bucketLink}`;
        
        // Normalize language name
        let lang = language.replace(/_/g, " ").replace(/-/g, " ");
        lang = lang.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        
        tracks.push({
          lang,
          url: buildSubtitleProxyUrl(downloadUrl),
          format: "srt",
          default: language.toLowerCase() === "english",
        });
      }
    }
    
    // Deduplicate by language (keep first of each)
    const seen = new Set<string>();
    const unique = tracks.filter(t => {
      const key = t.lang.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log("[Subdl] Found", unique.length, "unique subtitle tracks");
    return unique;
  } catch (e) {
    console.warn("[Subdl] Season data error:", e);
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
  // Subdl works best for TV shows with seasons
  if (type !== "tv" || !season) {
    console.log("[Subdl] Skipping: not a TV show with season");
    return [];
  }
  
  try {
    // Get show name from TMDB
    const showName = await tmdbToShowName(tmdbId, type);
    if (!showName) {
      console.warn("[Subdl] Could not get show name for TMDB ID:", tmdbId);
      return [];
    }
    
    console.log("[Subdl] Looking up:", showName, `S${season}E${episode || "all"}`);
    
    // Find show info (sd_id and slug)
    const showInfo = await findShowInfo(showName);
    if (!showInfo) {
      console.warn("[Subdl] Could not find show info for:", showName);
      return [];
    }
    
    // Fetch season subtitles
    return await fetchSeasonSubtitles(showInfo.sdId, showInfo.slug, season, episode);
  } catch (e) {
    console.warn("[Subdl] Error:", e);
    return [];
  }
}