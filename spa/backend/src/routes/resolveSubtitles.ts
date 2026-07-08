import { Router, type Request, type Response } from "express";
import { getCacheKey, getFromCache, setInCache } from "../cache.js";
import { resolveWithCinePro } from "../providers/cinepro-fallback.js";
import { scrapeSubdl } from "../providers/subtitle-scraper.js";
import { scrapeSubdlNew } from "../providers/subtitle-subdl.js";
import { resolveFreeSubtitles } from "../providers/subtitle-freestream.js";
import { scrapeAddic7ed } from "../providers/subtitle-addic7ed.js";
import { scrapeSubSource } from "../providers/subtitle-subsource.js";
import type { SubtitleTrack } from "../providers/cinepro.types.js";

const router = Router();
const SUB_CACHE_PREFIX = "subs_";

router.post("/resolve-subtitles", async (req: Request, res: Response) => {
  const { tmdbId, type = "tv", season, episode, imdbId } = req.body as any;
  if (!tmdbId) return res.status(400).json({ success: false, error: "Missing tmdbId" });
  const s = Number(season) || 1, e = Number(episode) || 1;
  const subKey = SUB_CACHE_PREFIX + getCacheKey(tmdbId, s, e);

  // 1) Check dedicated subtitle cache
  const cached = getFromCache<SubtitleTrack[]>(subKey);
  if (cached && cached.length > 0) {
    console.log('[Subs] Cache hit: ' + cached.length + ' tracks for ' + tmdbId + ' S=' + s + ' E=' + e);
    return res.json({ success: true, subtitles: cached, provider_results: { cache: cached.length } });
  }

  // 2) Check main resolve cache (CinePro waterfalls store subtitles in the response)
  const resolveKey = getCacheKey(tmdbId, s, e);
  const cachedResolve = getFromCache<any>(resolveKey);
  if (cachedResolve?.subtitles?.length > 0) {
    const subs = cachedResolve.subtitles as SubtitleTrack[];
    setInCache(subKey, subs);
    console.log('[Subs] Extracted ' + subs.length + ' tracks from resolve cache for ' + tmdbId);
    return res.json({ success: true, subtitles: subs, provider_results: { fromResolveCache: subs.length } });
  }

  // 3) Run CinePro waterfall (collects subtitles from Videasy + Popr phases)
  console.log('[Subs] Running CinePro waterfall for subtitles: ' + tmdbId + ' S=' + s + ' E=' + e);
  const cp = await resolveWithCinePro(tmdbId, s, e).catch(() => ({ sources: [], subtitles: [] as SubtitleTrack[] }));
  if (cp.subtitles.length > 0) {
    setInCache(subKey, cp.subtitles);
    console.log('[Subs] CinePro found ' + cp.subtitles.length + ' sub tracks');
    return res.json({ success: true, subtitles: cp.subtitles, provider_results: { cinepro: cp.subtitles.length } });
  }

  // 4) Fallback: free scrapers (Addic7ed + SubSource + Subdl new + Podnapisi + Subdl old)
  console.log('[Subs] CinePro no subs, trying free scrapers...');
  const [subdlT, subdlNewT, freeT, addic7edT, subsourceT] = await Promise.all([
    scrapeSubdl(tmdbId, type, s, e, imdbId).catch((e: any) => { console.warn('[Subs] Subdl old failed', e?.message || ''); return [] as SubtitleTrack[]; }),
    scrapeSubdlNew(tmdbId, type, s, e).catch((e: any) => { console.warn('[Subs] Subdl new failed', e?.message || ''); return [] as SubtitleTrack[]; }),
    resolveFreeSubtitles(tmdbId, type, s, e, imdbId || null).catch((e: any) => { console.warn('[Subs] Free failed', e?.message || ''); return [] as SubtitleTrack[]; }),
    scrapeAddic7ed(tmdbId, type, s, e).catch((e: any) => { console.warn('[Subs] Addic7ed failed', e?.message || ''); return [] as SubtitleTrack[]; }),
    scrapeSubSource(tmdbId, type, s, e).catch((e: any) => { console.warn('[Subs] SubSource failed', e?.message || ''); return [] as SubtitleTrack[]; }),
  ]);
  const dedup = new Map<string, SubtitleTrack>();
  for (const t of [...addic7edT, ...subsourceT, ...subdlNewT, ...subdlT, ...freeT]) { if (!dedup.has(t.lang.toLowerCase())) dedup.set(t.lang.toLowerCase(), t); }
  const final = Array.from(dedup.values());
  if (final.length > 0) setInCache(subKey, final);
  console.log('[Subs] Final: ' + final.length + ' tracks (Addic7ed=' + addic7edT.length + ', SubSource=' + subsourceT.length + ', SubdlNew=' + subdlNewT.length + ', Subdl=' + subdlT.length + ', Free=' + freeT.length + ')');
  return res.json({ success: true, subtitles: final, provider_results: { addic7ed: addic7edT.length, subsource: subsourceT.length, subdlNew: subdlNewT.length, subdl: subdlT.length, free: freeT.length } });
});

export default router;
