/**
 * SubSource.net subtitle scraper
 * 
 * API endpoints discovered:
 * - Trending: https://api.subsource.net/v1/movie/trending
 * - Show info: https://api.subsource.net/v1/movie/{id}
 * - Subtitle listings: https://api.subsource.net/v1/subtitles/{show-slug}/season-{n}
 * - Subtitle details: https://api.subsource.net/v1/subtitle/{show-slug}/{lang}/{id}
 * - Download: https://api.subsource.net/v1/subtitle/download/{token}
 */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";

const API_BASE = "https://api.subsource.net";

interface SubsourceSubtitle {
  id: number;
  language: string;
  release_type: string;
  release_info: string;
  upload_date: string;
  hearing_impaired: number;
  caption: string;
  rating: string;
  link: string;
  production_type: string;
}

interface SubsourceDetail {
  subtitle: {
    id: number;
    language: string;
    rating: string;
    release_info: string[];
    download_token: string;
    preview?: string;
  };
  movie: {
    id: number;
    title: string;
    type: string;
    link_name: string;
    full_link_name: string;
  };
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
 * Convert show name to SubSource slug format
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Fetch subtitle listings for a show/season
 */
async function fetchSubtitleListings(showSlug: string, season: number): Promise<SubsourceSubtitle[]> {
  try {
    const url = `${API_BASE}/v1/subtitles/${showSlug}/season-${season}`;
    console.log("[SubSource] Fetching listings:", url);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!res.ok) {
      console.warn("[SubSource] Listings failed:", res.status);
      return [];
    }
    
    const data = await res.json() as any;
    return data?.subtitles || [];
  } catch (e) {
    console.warn("[SubSource] Listings error:", e);
    return [];
  }
}

/**
 * Fetch subtitle details including download token
 */
async function fetchSubtitleDetails(showSlug: string, language: string, subtitleId: number): Promise<SubsourceDetail | null> {
  try {
    const url = `${API_BASE}/v1/subtitle/${showSlug}/${language}/${subtitleId}`;
    console.log("[SubSource] Fetching details:", url);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!res.ok) {
      console.warn("[SubSource] Details failed:", res.status);
      return null;
    }
    
    return await res.json() as SubsourceDetail;
  } catch (e) {
    console.warn("[SubSource] Details error:", e);
    return null;
  }
}

/**
 * Main entry point: resolve subtitles from SubSource
 */
export async function scrapeSubSource(
  tmdbId: string, 
  type: string, 
  season?: number, 
  episode?: number
): Promise<SubtitleTrack[]> {
  // SubSource only supports TV shows with seasons
  if (type !== "tv" || !season) {
    console.log("[SubSource] Skipping: not a TV show with season");
    return [];
  }
  
  try {
    // Get show name from TMDB
    const showName = await tmdbToShowName(tmdbId, type);
    if (!showName) {
      console.warn("[SubSource] Could not get show name for TMDB ID:", tmdbId);
      return [];
    }
    
    const showSlug = toSlug(showName);
    console.log("[SubSource] Looking up:", showName, "-> slug:", showSlug, "S" + season);
    
    // Fetch subtitle listings
    const listings = await fetchSubtitleListings(showSlug, season);
    if (listings.length === 0) {
      console.warn("[SubSource] No subtitles found for", showSlug);
      return [];
    }
    
    console.log("[SubSource] Found", listings.length, "subtitle listings");
    
    // Filter for English subtitles and specific episode if provided
    const englishSubs = listings.filter(sub => {
      if (sub.language !== "english") return false;
      // If episode is specified, check the link contains episode info
      // Link format: "house-of-the-dragon-season-3/arabic/10239742"
      return true; // We'll filter by episode in the details
    });
    
    if (englishSubs.length === 0) {
      console.log("[SubSource] No English subtitles found");
      return [];
    }
    
    // Get details for first few English subtitles to get download tokens
    const tracks: SubtitleTrack[] = [];
    const subsToCheck = englishSubs.slice(0, 5); // Limit to avoid too many requests
    
    for (const sub of subsToCheck) {
      // Parse the link to get show-slug/language/id
      const linkParts = sub.link.split('/');
      if (linkParts.length < 3) continue;
      
      const detailSlug = linkParts[0]; // e.g., "house-of-the-dragon-season-3"
      const lang = linkParts[1];
      const subId = parseInt(linkParts[2], 10);
      
      if (!subId) continue;
      
      // Fetch details to get download token
      const details = await fetchSubtitleDetails(detailSlug, lang, subId);
      if (!details?.subtitle?.download_token) {
        console.warn("[SubSource] No download token for subtitle", subId);
        continue;
      }
      
      // Check if this subtitle is for the requested episode
      // The release_info often contains episode info like "S03E03"
      if (episode) {
        const episodePattern = new RegExp(`[Ss]${String(season).padStart(2, '0')}[Ee]${String(episode).padStart(2, '0')}`);
        const releaseInfo = Array.isArray(details.subtitle.release_info) 
          ? details.subtitle.release_info.join(' ') 
          : '';
        if (!episodePattern.test(releaseInfo) && !episodePattern.test(sub.release_info || '')) {
          console.log("[SubSource] Subtitle", subId, "doesn't match episode", episode);
          continue;
        }
      }
      
      // Build download URL
      const downloadUrl = `${API_BASE}/v1/subtitle/download/${details.subtitle.download_token}`;
      
      tracks.push({
        lang: "English",
        url: buildSubtitleProxyUrl(downloadUrl),
        format: "srt", // SubSource provides ZIP files containing SRT
        default: true,
      });
      
      console.log("[SubSource] Found English subtitle:", subId, "token:", details.subtitle.download_token.slice(0, 20) + "...");
      
      // If we found one, that's enough for now
      if (tracks.length >= 1) break;
    }
    
    console.log("[SubSource] Total tracks:", tracks.length);
    return tracks;
  } catch (e) {
    console.warn("[SubSource] Error:", e);
    return [];
  }
}