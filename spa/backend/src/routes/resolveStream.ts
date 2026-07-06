import { Router, type Request, type Response } from "express";
import { getCacheKey, getFromCache, setInCache } from "../cache.js";
import { resolveWithConsumet } from "../providers/consumet-wrapper.js";
import { resolveWithCinePro } from "../providers/cinepro-fallback.js";
import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";
import { scrapeSubdl } from "../providers/subtitle-scraper.js";
import { buildProxyUrl } from "./proxyStream.js";
import type { ResolveStreamRequest, ResolveStreamResponse, StreamSource, SubtitleTrack } from "../providers/cinepro.types.js";
const router = Router();
router.post("/resolve-stream", async (req: Request, res: Response) => {
  const { tmdbId, type, season, episode, title } = req.body as ResolveStreamRequest & { title?: string };
  if (!tmdbId || typeof tmdbId !== "string") return res.status(400).json({ success: false, error: "Missing tmdbId" });
  if (type === "tv" && (season == null || episode == null)) return res.status(400).json({ success: false, error: "Season+episode required" });
  const s = Number(season) || 1, e = Number(episode) || 1, showTitle = title || "";
  const cacheKey = getCacheKey(tmdbId, s, e);
  const cached = getFromCache(cacheKey);
  if (cached) { cached.fromCache = true; return res.json(cached); }
  const to = (p: Promise<StreamSource[]>, ms: number) => Promise.race([p, new Promise<StreamSource[]>(r => setTimeout(() => r([]), ms))]);
  const ct = (p: Promise<any>, ms: number) => Promise.race([p, new Promise(r => setTimeout(() => r({ sources: [], subtitles: [] }), ms))]);
  const cp = await ct(resolveWithCinePro(tmdbId, s, e), 18000);
  const cs = showTitle ? await to(resolveWithConsumet(showTitle, tmdbId, s, e), 12000) : [];
  const seen = new Set<string>();
  const merged: StreamSource[] = [];
  for (const src of [...cp.sources, ...cs]) { if (src?.url && !seen.has(src.url)) { seen.add(src.url); merged.push(src); } }
  const sources = merged;
  const provider = cs.length > 0 && cp.sources.length > 0 ? "consumet+cinepro" : cp.sources.length > 0 ? "cinepro" : "consumet";
  let subtitles: SubtitleTrack[] = [...cp.subtitles];
  if (subtitles.length === 0 && sources.length > 0) {
    const [osT, subdlT] = await Promise.all([
      resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
      scrapeSubdl(tmdbId, type || "tv", s, e).catch(() => [] as SubtitleTrack[]),
    ]);
    const dd = new Map<string, SubtitleTrack>();
    for (const t of [...osT, ...subdlT]) { if (!dd.has(t.lang.toLowerCase())) dd.set(t.lang.toLowerCase(), t); }
    subtitles = Array.from(dd.values());
  }
  if (sources.length > 0) {
    const proxied = sources.map(s => ({ ...s, url: buildProxyUrl(s.url, s.headers) }));
    const resp = { success: true, data: { sources: proxied, subtitles: subtitles.length > 0 ? subtitles : undefined }, fromCache: false, provider, sources: proxied, subtitles: subtitles.length > 0 ? subtitles : undefined };
    setInCache(cacheKey, resp);
    return res.json(resp);
  } else { return res.json({ success: false, error: "No sources" }); }
});
export default router;
