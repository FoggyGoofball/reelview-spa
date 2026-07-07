/** OpenSubtitles provider - uses OPENSUBTITLES_API_KEY env var */
import type { SubtitleTrack } from "./cinepro.types.js";
import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";
const OS_API = "https://api.opensubtitles.com/api/v1";
async function processOpenSubtitles(subs: any[], headers: Record<string, string>): Promise<SubtitleTrack[]> {
  const tracks: SubtitleTrack[] = [];
  for (const sub of subs.slice(0, 5)) {
    const attrs = sub.attributes || sub;
    if (!attrs?.files?.[0]?.file_id) continue;
    const lang = attrs.language || attrs.language_name || 'Unknown';
    const fileName = attrs.files[0].file_name || '';
    try {
      const dl = await fetch(OS_API + '/download', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: attrs.files[0].file_id }),
        signal: AbortSignal.timeout(10000),
      });
      if (!dl.ok) continue;
      const dlData = await dl.json() as any;
      const url = dlData?.link;
      if (!url) continue;
      const ext = fileName.split('.').pop()?.toLowerCase() || 'srt';
      const fmt = ext === 'vtt' ? 'vtt' : ext === 'ass' ? 'ass' : 'srt';
      tracks.push({ lang, url: buildSubtitleProxyUrl(url), format: fmt, default: lang.toLowerCase() === 'english' });
    } catch { continue; }
  }
  return tracks;
}

export async function resolveWithOpenSubtitles(
  tmdbId: string, season?: number, episode?: number
): Promise<SubtitleTrack[]> {
  const apiKey = process.env.OPENSUBTITLES_API_KEY || "";
  if (!apiKey || !tmdbId) return [];
  const headers: Record<string, string> = {
    "Api-Key": apiKey, "User-Agent": "ReelView v1.0",
    Accept: "application/json",
  };
  try {
    const isEpisode = season != null;
    const params = new URLSearchParams();
    if (isEpisode) {
      // OpenSubtitles API expects parent_tmdb_id for episodes (the SHOW's TMDB id)
      params.set("parent_tmdb_id", tmdbId);
      params.set("season_number", String(season));
      params.set("episode_number", String(episode));
    } else {
      params.set("tmdb_id", tmdbId);
    }
    params.set("languages", "en");
    params.set("type", isEpisode ? "episode" : "movie");
    const res = await fetch(OS_API + "/subtitles?" + params.toString(), { headers, signal: AbortSignal.timeout(10000) });
    if (res.status === 401) { console.warn("[OpenSubtitles] Invalid API key"); return []; }
    if (!res.ok) { console.warn("[OpenSubtitles] Search failed: " + res.status); return []; }
    const data = await res.json() as any;
    console.log('[OpenSubtitles] API response: ' + JSON.stringify(data).slice(0, 500));
    const subs = data?.data ?? [];
    if (!Array.isArray(subs) || subs.length === 0) {
      console.warn('[OpenSubtitles] Zero subtitles for tmdbId=' + tmdbId + ' S=' + season + ' E=' + episode);
      // Fallback: search by IMDB query
      try {
        const queryParams = new URLSearchParams({ query: tmdbId + ' season ' + (season || 1) + ' episode ' + (episode || 1), languages: 'en' });
        const qRes = await fetch(OS_API + '/subtitles?' + queryParams.toString(), { headers, signal: AbortSignal.timeout(8000) });
        if (qRes.ok) {
          const qData = await qRes.json() as any;
          const qSubs = qData?.data ?? [];
          if (Array.isArray(qSubs) && qSubs.length > 0) {
            console.log('[OpenSubtitles] Fallback query found ' + qSubs.length + ' subtitles');
            return await processOpenSubtitles(qSubs, headers);
          }
        }
      } catch { }
      return [];
    }
    const tracks: SubtitleTrack[] = [];
    for (const sub of subs.slice(0, 5)) {
      const attrs = sub.attributes;
      if (!attrs?.files?.[0]?.file_id) continue;
      const lang = attrs.language || attrs.language_name || "Unknown";
      const fileName = attrs.files[0].file_name || "";
      try {
        const dl = await fetch(OS_API + "/download", {
          method: "POST", headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: attrs.files[0].file_id }),
          signal: AbortSignal.timeout(10000),
        });
        if (!dl.ok) continue;
        const dlData = await dl.json() as any;
        const url = dlData?.link;
        if (!url) continue;
        const ext = fileName.split(".").pop()?.toLowerCase() || "srt";
        const fmt = ext === "vtt" ? "vtt" : ext === "ass" ? "ass" : "srt";
        tracks.push({ lang, url: buildSubtitleProxyUrl(url), format: fmt, default: lang.toLowerCase() === "english" });
      } catch { continue; }
    }
    return tracks;
  } catch { return []; }
}
