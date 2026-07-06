import { Router, type Request, type Response } from "express";
import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";
import { scrapeSubdl } from "../providers/subtitle-scraper.js";
import type { SubtitleTrack } from "../providers/cinepro.types.js";
const router = Router();
router.post("/resolve-subtitles", async (req: Request, res: Response) => {
  const { tmdbId, type = "tv", season, episode } = req.body as any;
  if (!tmdbId) return res.status(400).json({ success: false, error: "Missing tmdbId" });
  const s = Number(season) || 1, e = Number(episode) || 1;
  const dedup = new Map<string, SubtitleTrack>();
  const [osT, subdlT] = await Promise.all([
    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),
    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),
  ]);
  for (const t of [...osT, ...subdlT]) { if (!dedup.has(t.lang.toLowerCase())) dedup.set(t.lang.toLowerCase(), t); }
  console.log("[ResolveSubtitles] Found " + dedup.size + " tracks for " + tmdbId);
  return res.json({ success: true, subtitles: Array.from(dedup.values()) });
});
export default router;
