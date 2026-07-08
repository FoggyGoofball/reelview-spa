/**
 * Addic7ed subtitle scraper
 * 
 * URL patterns discovered:
 * - Search: https://www.addic7ed.com/search.php?search={show_name}
 * - Show page: https://www.addic7ed.com/show/{showId}
 * - AJAX endpoint: https://www.addic7ed.com/ajax_loadShow.php?show={showId}&season={season}
 * - Download: https://www.addic7ed.com/updated/{langId}/{episodeId}/{subId}
 * 
 * Language IDs (from HTML):
 * - 1 = English
 * - 8 = French
 * - etc.
 */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

// Cache for show name -> show ID mapping
const showIdCache = new Map<string, number>();

// Common show IDs for popular shows (discovered through research)
const KNOWN_SHOW_IDS: Record<string, number> = {
  "game of thrones": 1245,
  "breaking bad": 1396,
  "the big bang theory": 126,
  "house": 15,
  "family guy": 130,
  "shameless": 1277,
  "american horror story": 1799,
};

/**
 * Search for a show by name and return its Addic7ed show ID
 */
async function findShowId(showName: string): Promise<number | null> {
  const cacheKey = showName.toLowerCase();
  
  // Check cache first
  if (showIdCache.has(cacheKey)) {
    return showIdCache.get(cacheKey)!;
  }
  
  // Check known IDs
  if (KNOWN_SHOW_IDS[cacheKey]) {
    showIdCache.set(cacheKey, KNOWN_SHOW_IDS[cacheKey]);
    return KNOWN_SHOW_IDS[cacheKey];
  }
  
  try {
    const searchUrl = `https://www.addic7ed.com/search.php?search=${encodeURIComponent(showName)}`;
    console.log("[Addic7ed] Searching for show:", showName);
    
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      console.warn("[Addic7ed] Search failed:", res.status);
      return null;
    }
    
    const html = await res.text();
    
    // Look for serie links that match the show name
    // Pattern: href="/serie/Show_Name/season/episode/title"
    const showNameUnderscore = showName.replace(/ /g, "_");
    const serieRegex = new RegExp(`href="/serie/${showNameUnderscore}/(\\d+)/(\\d+)/[^"]+"`, "i");
    const match = serieRegex.exec(html);
    
    if (match) {
      // Found a matching serie link, now we need the show ID
      // The show ID is in the AJAX loadShow call or the season buttons
      // Look for: loadShow(1245, ...) or onmouseup="javascript:loadShow(1245,...
      const loadShowMatch = html.match(/loadShow\((\d+),/);
      if (loadShowMatch) {
        const showId = parseInt(loadShowMatch[1], 10);
        showIdCache.set(cacheKey, showId);
        console.log("[Addic7ed] Found show ID:", showId, "for", showName);
        return showId;
      }
    }
    
    // Alternative: look for any loadShow call in the page
    const anyLoadShow = html.match(/loadShow\((\d+),/);
    if (anyLoadShow) {
      const showId = parseInt(anyLoadShow[1], 10);
      // Verify this is the right show by checking the page title
      if (html.toLowerCase().includes(showName.toLowerCase())) {
        showIdCache.set(cacheKey, showId);
        console.log("[Addic7ed] Found show ID via loadShow:", showId, "for", showName);
        return showId;
      }
    }
    
    console.warn("[Addic7ed] Could not find show ID for:", showName);
    return null;
  } catch (e) {
    console.warn("[Addic7ed] Search error:", e);
    return null;
  }
}

/**
 * Fetch subtitles from Addic7ed AJAX endpoint
 */
async function fetchSubtitlesFromAjax(
  showId: number, 
  season: number, 
  episode: number
): Promise<SubtitleTrack[]> {
  try {
    const ajaxUrl = `https://www.addic7ed.com/ajax_loadShow.php?show=${showId}&season=${season}&langs=&hd=&hi=`;
    console.log("[Addic7ed] Fetching AJAX:", ajaxUrl);
    
    const res = await fetch(ajaxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,*/*",
        "Referer": `https://www.addic7ed.com/show/${showId}`,
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!res.ok) {
      console.warn("[Addic7ed] AJAX failed:", res.status);
      return [];
    }
    
    const html = await res.text();
    const tracks: SubtitleTrack[] = [];
    
    // Parse table rows for the specific episode
    // Pattern: <tr class="..."><td>{season}</td><td>{episode}</td>...<td>{language}</td>...<a href="/updated/{langId}/{episodeId}/{subId}">Download</a>
    const rowRegex = /<tr[^>]*>([\s\S]{0,1500}?)<\/tr>/gi;
    let match;
    
    while ((match = rowRegex.exec(html)) !== null) {
      const row = match[1];
      
      // Check if this row is for our episode
      // Pattern: <td>{season}</td><td>{episode}</td>
      const episodePattern = new RegExp(`<td>${season}</td><td>${episode}</td>`);
      if (!episodePattern.test(row)) continue;
      
      // Extract language
      const langMatch = row.match(/<td>(English|French|Spanish|German|Italian|Portuguese|Dutch|Polish|Russian|Chinese|Japanese|Korean|Arabic|Turkish|Greek|Hungarian|Romanian|Bulgarian|Czech|Swedish|Danish|Finnish|Norwegian|Hebrew|Persian|Catalan|Basque|Galician|Portuguese \(Brazilian\)|Spanish \(Latin America\))<\/td>/i);
      if (!langMatch) continue;
      
      const language = langMatch[1];
      
      // Extract download link
      const dlMatch = row.match(/href="\/updated\/(\d+)\/(\d+)\/(\d+)"/);
      if (!dlMatch) continue;
      
      const downloadUrl = `https://www.addic7ed.com/updated/${dlMatch[1]}/${dlMatch[2]}/${dlMatch[3]}`;
      
      // Extract version/release info
      const versionMatch = row.match(/<td class="c">([^<]+)<\/td>/);
      const version = versionMatch ? versionMatch[1].trim() : "";
      
      // Check if completed - look for class="completed" or text "Completed" or "Terminé" (French)
      const isCompleted = match[0].includes('class="') && 
        (match[0].includes('completed') || row.includes("Completed") || row.includes("Terminé") || row.includes("Completado"));
      if (!isCompleted) continue; // Skip incomplete subtitles
      
      tracks.push({
        lang: language,
        url: buildSubtitleProxyUrl(downloadUrl),
        format: "srt",
        default: language.toLowerCase() === "english",
      });
      
      console.log("[Addic7ed] Found:", language, version, downloadUrl);
    }
    
    // Deduplicate by language (keep first English, first of each other language)
    const seen = new Set<string>();
    const unique = tracks.filter(t => {
      const key = t.lang.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    console.log("[Addic7ed] Total unique tracks:", unique.length);
    return unique;
  } catch (e) {
    console.warn("[Addic7ed] AJAX error:", e);
    return [];
  }
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
 * Main entry point: resolve subtitles from Addic7ed
 */
export async function scrapeAddic7ed(
  tmdbId: string, 
  type: string, 
  season?: number, 
  episode?: number
): Promise<SubtitleTrack[]> {
  // Addic7ed only supports TV shows
  if (type !== "tv" || !season || !episode) {
    console.log("[Addic7ed] Skipping: not a TV episode");
    return [];
  }
  
  try {
    // Get show name from TMDB
    const showName = await tmdbToShowName(tmdbId, type);
    if (!showName) {
      console.warn("[Addic7ed] Could not get show name for TMDB ID:", tmdbId);
      return [];
    }
    
    console.log("[Addic7ed] Looking up:", showName, "S" + season + "E" + episode);
    
    // Find show ID
    const showId = await findShowId(showName);
    if (!showId) {
      console.warn("[Addic7ed] Show not found:", showName);
      return [];
    }
    
    // Fetch subtitles
    return await fetchSubtitlesFromAjax(showId, season, episode);
  } catch (e) {
    console.warn("[Addic7ed] Error:", e);
    return [];
  }
}