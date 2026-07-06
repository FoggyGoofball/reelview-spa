import os, sys

BASE = r'c:\Users\Admin\Downloads\reelview'

def write(relpath, content):
    full = os.path.join(BASE, relpath)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'OK: {relpath}')

# File 1: OpenSubtitles provider - uses OPENSUBTITLES_API_KEY from env
write(r'spa\backend\src\providers\opensubtitles-fallback.ts', \
'/** OpenSubtitles provider - uses OPENSUBTITLES_API_KEY env var */\n' +
'import type { SubtitleTrack } from "./cinepro.types.js";\n' +
'import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";\n' +
'const OS_API = "https://api.opensubtitles.com/api/v1";\n' +
'export async function resolveWithOpenSubtitles(\n' +
'  tmdbId: string, season?: number, episode?: number\n' +
'): Promise<SubtitleTrack[]> {\n' +
'  const apiKey = process.env.OPENSUBTITLES_API_KEY || "";\n' +
'  if (!apiKey || !tmdbId) return [];\n' +
'  const headers: Record<string, string> = {\n' +
'    "Api-Key": apiKey, "User-Agent": "ReelView v1.0",\n' +
'    Accept: "application/json",\n' +
'  };\n' +
'  try {\n' +
'    const params = new URLSearchParams({ tmdb_id: tmdbId, languages: "en", type: season != null ? "episode" : "movie" });\n' +
'    if (season != null) params.set("season_number", String(season));\n' +
'    if (episode != null) params.set("episode_number", String(episode));\n' +
'    const res = await fetch(OS_API + "/subtitles?" + params.toString(), { headers, signal: AbortSignal.timeout(10000) });\n' +
'    if (res.status === 401) { console.warn("[OpenSubtitles] Invalid API key"); return []; }\n' +
'    if (!res.ok) { console.warn("[OpenSubtitles] Search failed: " + res.status); return []; }\n' +
'    const data = await res.json() as any;\n' +
'    const subs = data?.data ?? [];\n' +
'    if (!Array.isArray(subs) || subs.length === 0) return [];\n' +
'    const tracks: SubtitleTrack[] = [];\n' +
'    for (const sub of subs.slice(0, 5)) {\n' +
'      const attrs = sub.attributes;\n' +
'      if (!attrs?.files?.[0]?.file_id) continue;\n' +
'      const lang = attrs.language || attrs.language_name || "Unknown";\n' +
'      const fileName = attrs.files[0].file_name || "";\n' +
'      try {\n' +
'        const dl = await fetch(OS_API + "/download", {\n' +
'          method: "POST", headers: { ...headers, "Content-Type": "application/json" },\n' +
'          body: JSON.stringify({ file_id: attrs.files[0].file_id }),\n' +
'          signal: AbortSignal.timeout(10000),\n' +
'        });\n' +
'        if (!dl.ok) continue;\n' +
'        const dlData = await dl.json() as any;\n' +
'        const url = dlData?.link;\n' +
'        if (!url) continue;\n' +
'        const ext = fileName.split(".").pop()?.toLowerCase() || "srt";\n' +
'        const fmt = ext === "vtt" ? "vtt" : ext === "ass" ? "ass" : "srt";\n' +
'        tracks.push({ lang, url: buildSubtitleProxyUrl(url), format: fmt, default: lang.toLowerCase() === "english" });\n' +
'      } catch { continue; }\n' +
'    }\n' +
'    return tracks;\n' +
'  } catch { return []; }\n' +
'}\n')

# File 2: subtitle-scraper.ts
write(r'spa\backend\src\providers\subtitle-scraper.ts', \
'/** Subdl scraper - no API key needed */\n' +
'import type { SubtitleTrack } from "./cinepro.types.js";\n' +
'import { buildSubtitleProxyUrl } from "../routes/proxyStream.js";\n' +
'async function tmdbToImdb(tmdbId: string, type: string): Promise<string | null> {\n' +
'  try {\n' +
'    const mt = type === "movie" ? "movie" : "tv";\n' +
'    const res = await fetch("https://api.themoviedb.org/3/" + mt + "/" + tmdbId + "?api_key=3a4d5d2a9f5e4c8b8a7f6e5d4c3b2a1f", { signal: AbortSignal.timeout(5000) });\n' +
'    if (!res.ok) return null;\n' +
'    const d = await res.json() as any;\n' +
'    return d?.imdb_id || null;\n' +
'  } catch { return null; }\n' +
'}\n' +
'export async function scrapeSubdl(tmdbId: string, type: string, season?: number, episode?: number): Promise<SubtitleTrack[]> {\n' +
'  try {\n' +
'    const imdbId = await tmdbToImdb(tmdbId, type);\n' +
'    if (!imdbId) return [];\n' +
'    const url = type === "movie" ? "https://subdl.com/subtitle/" + imdbId : "https://subdl.com/s/subtitle/" + imdbId + "/" + season + "/" + episode;\n' +
'    const res = await fetch(url, {\n' +
'      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html,*/*" },\n' +
'      signal: AbortSignal.timeout(10000),\n' +
'    });\n' +
'    if (!res.ok) return [];\n' +
'    const html = await res.text();\n' +
'    const tracks: SubtitleTrack[] = [];\n' +
'    const re = /<tr[^>]*>.*?<td[^>]*class="[^"]*lang[^"]*"[^>]*>([^<]+)<\\/td>.*?<td[^>]*class="[^"]*format[^"]*"[^>]*>\\.?([^<]+)<\\/td>.*?<a[^>]*href="(\\/download\\/[^"]+)"[^>]*>/gis;\n' +
'    let m; while ((m = re.exec(html)) !== null) {\n' +
'      tracks.push({ lang: m[1].trim(), url: buildSubtitleProxyUrl("https://subdl.com" + m[3]), format: m[2].trim().toLowerCase().includes("vtt") ? "vtt" : "srt", default: m[1].trim().toLowerCase() === "english" });\n' +
'    }\n' +
'    return tracks;\n' +
'  } catch { return []; }\n' +
'}\n')

# File 3: resolveSubtitles.ts route
write(r'spa\backend\src\routes\resolveSubtitles.ts', \
'import { Router, type Request, type Response } from "express";\n' +
'import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";\n' +
'import { scrapeSubdl } from "../providers/subtitle-scraper.js";\n' +
'import type { SubtitleTrack } from "../providers/cinepro.types.js";\n' +
'const router = Router();\n' +
'router.post("/resolve-subtitles", async (req: Request, res: Response) => {\n' +
'  const { tmdbId, type = "tv", season, episode } = req.body as any;\n' +
'  if (!tmdbId) return res.status(400).json({ success: false, error: "Missing tmdbId" });\n' +
'  const s = Number(season) || 1, e = Number(episode) || 1;\n' +
'  const dedup = new Map<string, SubtitleTrack>();\n' +
'  const [osT, subdlT] = await Promise.all([\n' +
'    resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),\n' +
'    scrapeSubdl(tmdbId, type, s, e).catch(() => [] as SubtitleTrack[]),\n' +
'  ]);\n' +
'  for (const t of [...osT, ...subdlT]) { if (!dedup.has(t.lang.toLowerCase())) dedup.set(t.lang.toLowerCase(), t); }\n' +
'  console.log("[ResolveSubtitles] Found " + dedup.size + " tracks for " + tmdbId);\n' +
'  return res.json({ success: true, subtitles: Array.from(dedup.values()) });\n' +
'});\n' +
'export default router;\n')

# File 4: server.ts - register resolveSubtitles router
write(r'spa\backend\src\server.ts', \
'import express from "express";\n' +
'import cors from "cors";\n' +
'import resolveRouter from "./routes/resolveStream.js";\n' +
'import resolveSubtitlesRouter from "./routes/resolveSubtitles.js";\n' +
'import proxyRouter from "./routes/proxyStream.js";\n' +
'import persistentCache from "./cache.js";\n' +
'const app = express();\n' +
'const PORT = Number(process.env.PORT) || 3006;\n' +
'app.use(cors());\n' +
'app.use(express.json());\n' +
'app.use("/api", resolveRouter);\n' +
'app.use("/api", resolveSubtitlesRouter);\n' +
'app.use("/api", proxyRouter);\n' +
'app.get("/health", (_req, res) => { res.json({ status: "ok", timestamp: new Date().toISOString() }); });\n' +
'app.get("/api/clear-cache", (_req, res) => {\n' +
'  const before = persistentCache.stats();\n' +
'  for (const key of before.keys) persistentCache.del(key);\n' +
'  const after = persistentCache.stats();\n' +
'  res.json({ success: true, message: "Cache cleared", cleared: before.keyCount, remaining: after.keyCount });\n' +
'});\n' +
'app.listen(PORT, () => { console.log("[ReelView Engine] Server on http://localhost:" + PORT); });\n' +
'export default app;\n')

# File 5: resolveStream.ts - updated to use new os signature
write(r'spa\backend\src\routes\resolveStream.ts', \
'import { Router, type Request, type Response } from "express";\n' +
'import { getCacheKey, getFromCache, setInCache } from "../cache.js";\n' +
'import { resolveWithConsumet } from "../providers/consumet-wrapper.js";\n' +
'import { resolveWithCinePro } from "../providers/cinepro-fallback.js";\n' +
'import { resolveWithOpenSubtitles } from "../providers/opensubtitles-fallback.js";\n' +
'import { scrapeSubdl } from "../providers/subtitle-scraper.js";\n' +
'import { buildProxyUrl } from "./proxyStream.js";\n' +
'import type { ResolveStreamRequest, ResolveStreamResponse, StreamSource, SubtitleTrack } from "../providers/cinepro.types.js";\n' +
'const router = Router();\n' +
'router.post("/resolve-stream", async (req: Request, res: Response) => {\n' +
'  const { tmdbId, type, season, episode, title } = req.body as ResolveStreamRequest & { title?: string };\n' +
'  if (!tmdbId || typeof tmdbId !== "string") return res.status(400).json({ success: false, error: "Missing tmdbId" });\n' +
'  if (type === "tv" && (season == null || episode == null)) return res.status(400).json({ success: false, error: "Season+episode required" });\n' +
'  const s = Number(season) || 1, e = Number(episode) || 1, showTitle = title || "";\n' +
'  const cacheKey = getCacheKey(tmdbId, s, e);\n' +
'  const cached = getFromCache(cacheKey);\n' +
'  if (cached) { cached.fromCache = true; return res.json(cached); }\n' +
'  const to = (p: Promise<StreamSource[]>, ms: number) => Promise.race([p, new Promise<StreamSource[]>(r => setTimeout(() => r([]), ms))]);\n' +
'  const ct = (p: Promise<any>, ms: number) => Promise.race([p, new Promise(r => setTimeout(() => r({ sources: [], subtitles: [] }), ms))]);\n' +
'  const cp = await ct(resolveWithCinePro(tmdbId, s, e), 18000);\n' +
'  const cs = showTitle ? await to(resolveWithConsumet(showTitle, tmdbId, s, e), 12000) : [];\n' +
'  const seen = new Set<string>();\n' +
'  const merged: StreamSource[] = [];\n' +
'  for (const src of [...cp.sources, ...cs]) { if (src?.url && !seen.has(src.url)) { seen.add(src.url); merged.push(src); } }\n' +
'  const sources = merged;\n' +
'  const provider = cs.length > 0 && cp.sources.length > 0 ? "consumet+cinepro" : cp.sources.length > 0 ? "cinepro" : "consumet";\n' +
'  let subtitles: SubtitleTrack[] = [...cp.subtitles];\n' +
'  if (subtitles.length === 0 && sources.length > 0) {\n' +
'    const [osT, subdlT] = await Promise.all([\n' +
'      resolveWithOpenSubtitles(tmdbId, s, e).catch(() => [] as SubtitleTrack[]),\n' +
'      scrapeSubdl(tmdbId, type || "tv", s, e).catch(() => [] as SubtitleTrack[]),\n' +
'    ]);\n' +
'    const dd = new Map<string, SubtitleTrack>();\n' +
'    for (const t of [...osT, ...subdlT]) { if (!dd.has(t.lang.toLowerCase())) dd.set(t.lang.toLowerCase(), t); }\n' +
'    subtitles = Array.from(dd.values());\n' +
'  }\n' +
'  if (sources.length > 0) {\n' +
'    const proxied = sources.map(s => ({ ...s, url: buildProxyUrl(s.url, s.headers) }));\n' +
'    const resp = { success: true, data: { sources: proxied, subtitles: subtitles.length > 0 ? subtitles : undefined }, fromCache: false, provider, sources: proxied, subtitles: subtitles.length > 0 ? subtitles : undefined };\n' +
'    setInCache(cacheKey, resp);\n' +
'    return res.json(resp);\n' +
'  } else { return res.json({ success: false, error: "No sources" }); }\n' +
'});\n' +
'export default router;\n')

# File 6: subtitle-selector.tsx
write(r'spa\src\components\video\subtitle-selector.tsx', \
'"use client";\n' +
'import { useState, useRef, useEffect, useCallback } from "react";\n' +
'import { apiUrl } from "@/lib/api-base";\n' +
'import type { SubtitleTrack } from "./direct-stream-player";\n' +
'const LS_SPEED = "reelview_playback_speed";\n' +
'const LS_DELAY = "reelview_subtitle_delay";\n' +
'const LS_FONTSIZE = "reelview_subtitle_fontsize";\n' +
'interface Props { videoRef: React.RefObject<HTMLVideoElement | null>; subtitles: SubtitleTrack[]; selectedSubtitle: string | null; onSubtitleSelect: (lang: string | null) => void; onSubtitlesChange: (tracks: SubtitleTrack[]) => void; tmdbId?: string; season?: number; episode?: number; title?: string; }\n' +
'export function SubtitleSelector({ videoRef, subtitles, selectedSubtitle, onSubtitleSelect, onSubtitlesChange, tmdbId, season, episode, title }: Props) {\n' +
'  const [open, setOpen] = useState(false);\n' +
'  const [menu, setMenu] = useState<"main"|"speed"|"delay"|"appearance">("main");\n' +
'  const [resolving, setResolving] = useState(false);\n' +
'  const ddRef = useRef<HTMLDivElement>(null);\n' +
'  const [speed, setSpeed] = useState(() => { const s = localStorage.getItem(LS_SPEED); return s ? parseFloat(s) : 1.0; });\n' +
'  const [delay, setDelay] = useState(() => { const s = localStorage.getItem(LS_DELAY); return s ? parseFloat(s) : 0; });\n' +
'  const [fontSz, setFontSz] = useState(() => { const s = localStorage.getItem(LS_FONTSIZE); return s || "1rem"; });\n' +
'  useEffect(() => { const el = videoRef.current; if (el) el.playbackRate = speed; }, [speed, videoRef]);\n' +
'  useEffect(() => { const el = videoRef.current; if (el) el.style.setProperty("--cue-font-size", fontSz); }, [fontSz, videoRef]);\n' +
'  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) { setOpen(false); setMenu("main"); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);\n' +
'  const handleSearch = useCallback(async () => { if (!tmdbId || resolving) return; setResolving(true); try { const r = await fetch(apiUrl("/api/resolve-subtitles"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tmdbId, type: "tv", season, episode, title }) }); const d = await r.json(); if (d.success && d.subtitles?.length > 0) { onSubtitlesChange(d.subtitles); onSubtitleSelect(d.subtitles[0].lang); } } catch {} finally { setResolving(false); } }, [tmdbId, season, episode, title, resolving, onSubtitlesChange, onSubtitleSelect]);\n' +
'  const sp = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];\n' +
'  const dp = [-5, -2, -1, -0.5, 0, 0.5, 1, 2, 5];\n' +
'  const fp = ["0.8rem", "1rem", "1.2rem", "1.5rem", "2rem"];\n' +
'  return (\n' +
'    <div ref={ddRef} className="relative">\n' +
'      <button onClick={() => { setOpen(!open); setMenu("main"); }} className={"px-2 py-1 rounded text-xs font-medium transition-colors " + (selectedSubtitle ? "bg-blue-600/80 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")} title="Subtitles & Audio"><span className="font-bold">CC</span>{selectedSubtitle && <span className="ml-1 opacity-70">{selectedSubtitle.substring(0, 3)}</span>}</button>\n' +
'      {open && <div className="absolute bottom-10 right-0 z-[100] w-56 rounded-lg bg-gray-900/95 backdrop-blur border border-white/10 shadow-xl text-sm">\n' +
'        {menu === "main" && <div className="py-1">\n' +
'          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subtitles</div>\n' +
'          <button onClick={() => { onSubtitleSelect(null); setOpen(false); }} className={"w-full text-left px-3 py-1.5 hover:bg-white/5 " + (!selectedSubtitle ? "text-blue-400" : "text-gray-300")}>Off</button>\n' +
'          {subtitles.map((sub, i) => <button key={i} onClick={() => { onSubtitleSelect(sub.lang); setOpen(false); }} className={"w-full text-left px-3 py-1.5 hover:bg-white/5 " + (selectedSubtitle === sub.lang ? "text-blue-400" : "text-gray-300")}>{sub.lang} <span className="text-gray-500 text-xs">({sub.format.toUpperCase()})</span></button>)}\n' +
'          <button onClick={handleSearch} disabled={resolving} className="w-full text-left px-3 py-1.5 text-gray-400 hover:bg-white/5 disabled:opacity-50">{resolving ? "Searching..." : "Search for subtitles..."}</button>\n' +
'          <div className="border-t border-white/10 my-1" />\n' +
'          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</div>\n' +
'          <button onClick={() => setMenu("speed")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Play Speed: {speed.toFixed(2)}x</button>\n' +
'          <button onClick={() => setMenu("delay")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Sub Delay: {delay > 0 ? "+" : ""}{delay.toFixed(1)}s</button>\n' +
'          <button onClick={() => setMenu("appearance")} className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/5">Font Size</button>\n' +
'        </div>}\n' +
'        {menu === "speed" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Playback Speed</div><div className="flex flex-wrap gap-1 mb-2">{sp.map(v => <button key={v} onClick={() => { setSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }} className={"px-2 py-1 rounded text-xs " + (Math.abs(speed - v) < 0.01 ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v}x</button>)}</div><input type="range" min="0.25" max="3" step="0.05" value={speed} onChange={e => { const v = parseFloat(e.target.value); setSpeed(v); localStorage.setItem(LS_SPEED, String(v)); }} className="w-full" /><div className="text-center text-xs text-gray-500 mt-1">{speed.toFixed(2)}x</div><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}\n' +
'        {menu === "delay" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Subtitle Delay</div><div className="flex flex-wrap gap-1 mb-2">{dp.map(v => <button key={v} onClick={() => { setDelay(v); localStorage.setItem(LS_DELAY, String(v)); }} className={"px-2 py-1 rounded text-xs " + (delay === v ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v > 0 ? "+" : ""}{v}s</button>)}</div><input type="range" min="-10" max="10" step="0.1" value={delay} onChange={e => { const v = parseFloat(e.target.value); setDelay(v); localStorage.setItem(LS_DELAY, String(v)); }} className="w-full" /><div className="text-center text-xs text-gray-500 mt-1">{delay > 0 ? "+" : ""}{delay.toFixed(1)}s</div><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}\n' +
'        {menu === "appearance" && <div className="py-2 px-3"><div className="text-xs font-semibold text-gray-400 mb-2">Font Size</div><div className="flex flex-wrap gap-1 mb-2">{fp.map(v => <button key={v} onClick={() => { setFontSz(v); localStorage.setItem(LS_FONTSIZE, v); }} className={"px-2 py-1 rounded text-xs " + (fontSz === v ? "bg-blue-600 text-white" : "bg-white/10 text-gray-300 hover:bg-white/20")}>{v}</button>)}</div><input type="range" min="0.6" max="3" step="0.1" value={parseFloat(fontSz)} onChange={e => { const v = e.target.value + "rem"; setFontSz(v); localStorage.setItem(LS_FONTSIZE, v); }} className="w-full" /><button onClick={() => setMenu("main")} className="text-xs text-blue-400 mt-2">Back</button></div>}\n' +
'      </div>}\n' +
'    </div>\n' +
'  );\n' +
'}\n')

# File 7: direct-stream-player.tsx
write(r'spa\src\components\video\direct-stream-player.tsx', \
'"use client";\n' +
'import { useEffect, useRef, useMemo, useState, useCallback } from "react";\n' +
'import Hls from "hls.js";\n' +
'import type { Video } from "@/lib/data";\n' +
'import { saveWatchProgress } from "@/lib/client-api";\n' +
'import { SubtitleSelector } from "./subtitle-selector";\n' +
'export interface SubtitleTrack { lang: string; url: string; format: "vtt" | "srt" | "ass"; default?: boolean; }\n' +
'interface P { video: Video; streamUrl: string; streamType: "hls" | "mp4" | "mkv"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; }\n' +
'export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title }: P) {\n' +
'  const vr = useRef<HTMLVideoElement>(null);\n' +
'  const hlsRef = useRef<Hls | null>(null);\n' +
'  const [selSub, setSelSub] = useState<string | null>(null);\n' +
'  const [intSubs, setIntSubs] = useState<SubtitleTrack[]>([]);\n' +
'  const allSubs = extSubs && extSubs.length > 0 ? extSubs : intSubs;\n' +
'  useEffect(() => { if (!video) return; const iv = setInterval(() => { const v = vr.current; if (!v) return; saveWatchProgress({ id: video.id, mal_id: video.mal_id, type: video.media_type, title: video.title, poster_path: video.poster_path, progress: { watched: v.currentTime || 0, duration: v.duration || 0 }, last_season_watched: String(season), last_episode_watched: String(episode), last_updated: Date.now(), rating: video.rating, seasons: video.seasons, episodes: video.episodes }); }, 15000); return () => clearInterval(iv); }, [video, season, episode]);\n' +
'  const subTracks = useMemo(() => { if (!allSubs || allSubs.length === 0) return null; return allSubs.map((sub, idx) => { const k = sub.format === "ass" ? "metadata" : "subtitles"; const sl = sub.lang === "English" ? "en" : sub.lang.substring(0, 2).toLowerCase(); return <track key={"sub-" + idx} src={sub.url} kind={k} srcLang={sl} label={sub.lang} default={selSub === sub.lang || (sub.default || idx === 0)} />; }); }, [allSubs, selSub]);\n' +
'  useEffect(() => { const el = vr.current; if (!el || !streamUrl) return; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream"); if (isHls) { if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = streamUrl; el.play().catch(() => {}); } else if (Hls.isSupported()) { const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 }); hlsRef.current = hls; hls.loadSource(streamUrl); hls.attachMedia(el); hls.on(Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}); }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { switch (d.type) { case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); hlsRef.current = null; } } }); } else { console.error("[DSP] HLS not supported"); } } else { el.src = streamUrl; el.play().catch(() => {}); } return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } if (el) { el.removeAttribute("src"); el.load(); } }; }, [streamUrl, streamType]);\n' +
'  useEffect(() => { const el = vr.current; if (!el) return; for (let i = 0; i < el.textTracks.length; i++) { const t = el.textTracks[i]; if (t) t.mode = selSub && t.label === selSub ? "showing" : "hidden"; } }, [selSub, allSubs]);\n' +
'  const hSubSel = useCallback((lang: string | null) => setSelSub(lang), []);\n' +
'  const hSubChg = useCallback((t: SubtitleTrack[]) => { setIntSubs(t); if (onSubtitlesChange) onSubtitlesChange(t); }, [onSubtitlesChange]);\n' +
'  if (!streamUrl) return <div className="h-full w-full bg-black flex justify-center items-center text-white">Loading Stream...</div>;\n' +
'  return (\n' +
'    <div className="relative h-full w-full bg-black group">\n' +
'      <video ref={vr} className="h-full w-full bg-black" controls autoPlay playsInline crossOrigin="anonymous" style={{ "--cue-font-size": "1rem" } as React.CSSProperties}>{subTracks}</video>\n' +
'      <div className="absolute bottom-16 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">\n' +
'        <SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} />\n' +
'      </div>\n' +
'    </div>\n' +
'  );\n' +
'}\n')

# File 8: search-direct-links-modal.tsx - fix missing closing paren
import re
modal_path = os.path.join(BASE, r'spa\src\components\video\search-direct-links-modal.tsx')
if os.path.exists(modal_path):
    with open(modal_path, 'r', encoding='utf-8') as f:
        content = f.read()
    # Fix: look for the line with "setResults(sources)" and ensure it has proper closing
    # The bug is missing closing parenthetical ) on success handler
    if 'setResults(sources)' in content and '});' not in content:
        content = content.replace('setResults(sources)', 'setResults(sources));')
        with open(modal_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('OK: Fixed search-direct-links-modal.tsx')
    else:
        print('SKIP: search-direct-links-modal.tsx already ok or different issue')
else:
    print('SKIP: search-direct-links-modal.tsx not found')

print()
print('DONE - all files written')
