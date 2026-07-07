"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Hls from "hls.js";
import type { Video } from "@/lib/data";
import { saveWatchProgress } from "@/lib/client-api";
import { SubtitleSelector } from "./subtitle-selector";
export interface SubtitleTrack { lang: string; url: string; format: "vtt" | "srt" | "ass"; default?: boolean; }
interface P { video: Video; streamUrl: string; streamType: "hls" | "mp4" | "mkv"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; }
export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title }: P) {
  const vr = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selSub, setSelSub] = useState<string | null>(null);
  const [intSubs, setIntSubs] = useState<SubtitleTrack[]>([]);
  const allSubs = extSubs && extSubs.length > 0 ? extSubs : intSubs;
  useEffect(() => { if (!video) return; const iv = setInterval(() => { const v = vr.current; if (!v) return; saveWatchProgress({ id: video.id, mal_id: video.mal_id, type: video.media_type, title: video.title, poster_path: video.poster_path, progress: { watched: v.currentTime || 0, duration: v.duration || 0 }, last_season_watched: String(season), last_episode_watched: String(episode), last_updated: Date.now(), rating: video.rating, seasons: video.seasons, episodes: video.episodes }); }, 15000); return () => clearInterval(iv); }, [video, season, episode]);
  const subTracks = useMemo(() => { if (!allSubs || allSubs.length === 0) return null; return allSubs.map((sub, idx) => { const k = sub.format === "ass" ? "metadata" : "subtitles"; const sl = sub.lang === "English" ? "en" : sub.lang.substring(0, 2).toLowerCase(); return <track key={"sub-" + idx} src={sub.url} kind={k} srcLang={sl} label={sub.lang} default={selSub === sub.lang || (sub.default || idx === 0)} />; }); }, [allSubs, selSub]);
  useEffect(() => { const el = vr.current; if (!el || !streamUrl) return; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream"); if (isHls) { if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = streamUrl; el.play().catch(() => {}); } else if (Hls.isSupported()) { const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 }); hlsRef.current = hls; hls.loadSource(streamUrl); hls.attachMedia(el); hls.on(Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}); }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { switch (d.type) { case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); hlsRef.current = null; } } }); } else { console.error("[DSP] HLS not supported"); } } else { el.src = streamUrl; el.play().catch(() => {}); } return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } if (el) { el.removeAttribute("src"); el.load(); } }; }, [streamUrl, streamType]);
  useEffect(() => { const el = vr.current; if (!el) return; for (let i = 0; i < el.textTracks.length; i++) { const t = el.textTracks[i]; if (t) t.mode = selSub && t.label === selSub ? "showing" : "hidden"; } }, [selSub, allSubs]);
  const hSubSel = useCallback((lang: string | null) => setSelSub(lang), []);
  const hSubChg = useCallback((t: SubtitleTrack[]) => { setIntSubs(t); if (onSubtitlesChange) onSubtitlesChange(t); }, [onSubtitlesChange]);
  if (!streamUrl) return <div className="h-full w-full bg-black flex justify-center items-center text-white">Loading Stream...</div>;
  return (
    <div className="relative h-full w-full bg-black group pb-14">
      <video ref={vr} className="h-full w-full bg-black object-contain" controls autoPlay playsInline crossOrigin="anonymous" style={{ "--cue-font-size": "1rem" } as React.CSSProperties}>{subTracks}</video>
      <div className="absolute bottom-16 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} />
      </div>
    </div>
  );
}
