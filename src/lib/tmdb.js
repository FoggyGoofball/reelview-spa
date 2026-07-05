// A simple client for the The Movie Database (TMDB) API
// https://www.themoviedb.org/
import pThrottle from 'p-throttle';
const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_REGION = 'US';
// TMDB has a rate limit of 50 requests per second. We can be a bit more generous here.
const throttle = pThrottle({
    limit: 10,
    interval: 1000
});
function getApiKey() {
    if (typeof window === 'undefined') {
        // During `next build`, process.env is available.
        // THIS IS A PLACEHOLDER and not secure for a real production app.
        // In a real app, this would be a secret passed during the build process.
        return process.env.TMDB_API_KEY || '3fa2f58b01fc2153fe716cb40c39dddf';
    }
    return localStorage.getItem('TMDB_API_KEY');
}
export const tmdbFetch = throttle(async (path, params = {}, options = {}) => {
    const apiKey = getApiKey();
    if (!apiKey) {
        // Don't even attempt to fetch if the API key isn't set.
        // This prevents console errors on the initial page load.
        if (typeof window !== 'undefined') {
            console.warn("TMDB API key is not set. Please set it in the application settings.");
        }
        return null;
    }
    const url = new URL(`${TMDB_API_URL}${path}`);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('language', 'en-US');
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }
    const response = await fetch(url.toString(), options);
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`TMDB API Error: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Failed to fetch from TMDB: ${response.statusText}`);
    }
    return response.json();
});
export async function getPopularMovies(page = 1) {
    const data = await tmdbFetch('/movie/popular', { page: String(page) });
    if (!data)
        return null;
    data.results.forEach(m => m.media_type = 'movie');
    return data.results;
}
export async function getPopularTvShows(page = 1) {
    const data = await tmdbFetch('/tv/popular', { page: String(page) });
    if (!data)
        return null;
    data.results.forEach(m => m.media_type = 'tv');
    return data.results;
}
export async function getMediaDetails(id, type, params = {}) {
    const path = `/${type}/${id}`;
    const data = await tmdbFetch(path, params);
    if (!data)
        return null;
    data.media_type = type;
    return data;
}
export async function getTvSeasonDetails(tvId, seasonNumber) {
    const path = `/tv/${tvId}/season/${seasonNumber}`;
    const data = await tmdbFetch(path);
    return data;
}
// A helper to consistently get the US content rating.
export function getTmdbRating(media) {
    var _a, _b, _c, _d, _e, _f;
    let rating = undefined;
    // For movies, the certification is in release_dates.
    if (media.release_dates) {
        const usRelease = media.release_dates.results.find(r => r.iso_3166_1 === TMDB_REGION);
        if (usRelease && usRelease.release_dates.length > 0) {
            // Find the first non-empty certification.
            rating = (_a = usRelease.release_dates.find(rd => rd.certification)) === null || _a === void 0 ? void 0 : _a.certification;
        }
    }
    // For TV shows, it's in content_ratings.
    if (!rating && media.content_ratings) {
        const usRating = media.content_ratings.results.find(r => r.iso_3166_1 === TMDB_REGION);
        if (usRating) {
            rating = usRating.rating;
        }
    }
    // Fallback if no US rating is found
    if (!rating && ((_c = (_b = media.content_ratings) === null || _b === void 0 ? void 0 : _b.results) === null || _c === void 0 ? void 0 : _c.length)) {
        rating = media.content_ratings.results[0].rating;
    }
    if (!rating && ((_e = (_d = media.release_dates) === null || _d === void 0 ? void 0 : _d.results) === null || _e === void 0 ? void 0 : _e.length)) {
        rating = (_f = media.release_dates.results[0].release_dates.find(rd => rd.certification)) === null || _f === void 0 ? void 0 : _f.certification;
    }
    return rating;
}
