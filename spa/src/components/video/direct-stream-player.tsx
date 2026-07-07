"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Hls from "hls.js";
import type { Video } from "@/lib/data";
import { saveWatchProgress } from "@/lib/client-api";
import { SubtitleSelector } from "./subtitle-selector";
export interface SubtitleTrack { lang: string; url: string; format: "vtt" | "srt" | "ass"; default?: boolean; }
interface P { video: Video; streamUrl: string; streamType: "hls" | "mp4" | "mkv"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; imdbId?: string; }
export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title, imdbId }: P) {
  const vr = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selSub, setSelSub] = useState<string | null>(null);
  const [intSubs, setIntSubs] = useState<SubtitleTrack[]>([]);
  const allSubs = intSubs.length > 0 ? intSubs : (extSubs || []);
  useEffect(() => { if (!video) return; const iv = setInterval(() => { const v = vr.current; if (!v) return; saveWatchProgress({ id: video.id, mal_id: video.mal_id, type: video.media_type, title: video.title, poster_path: video.poster_path, progress: { watched: v.currentTime || 0, duration: v.duration || 0 }, last_season_watched: String(season), last_episode_watched: String(episode), last_updated: Date.now(), rating: video.rating, seasons: video.seasons, episodes: video.episodes }); }, 15000); return () => clearInterval(iv); }, [video, season, episode]);
  const subTracks = useMemo(() => { if (!allSubs || allSubs.length === 0) return null; return allSubs.map((sub, idx) => { const k = sub.format === "ass" ? "metadata" : "subtitles"; const sl = sub.lang === "English" ? "en" : sub.lang.substring(0, 2).toLowerCase(); return <track key={"sub-" + idx} src={sub.url} kind={k} srcLang={sl} label={sub.lang} default={selSub === sub.lang || (sub.default || idx === 0)} />; }); }, [allSubs, selSub]);
  useEffect(() => { const el = vr.current; if (!el || !streamUrl) return; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream"); if (isHls) { if (el.canPlayType("application/vnd.apple.mpegurl")) { el.src = streamUrl; el.play().catch(() => {}); } else if (Hls.isSupported()) { const hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30, startLevel: -1 }); hlsRef.current = hls; hls.loadSource(streamUrl); hls.attachMedia(el); hls.on(Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}); }); hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { switch (d.type) { case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); hlsRef.current = null; } } }); } else { console.error("[DSP] HLS not supported"); } } else { el.src = streamUrl; el.play().catch(() => {}); } return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } if (el) { el.removeAttribute("src"); el.load(); } }; }, [streamUrl, streamType]);
  /** Extract embedded subtitle tracks from HLS manifest after loading */
  useEffect(() => {
    const el = vr.current;
    if (!el) return;
    let attempts = 0;
    const check = () => {
      attempts++;
      if (el.textTracks.length > 0) {
        const embedded: SubtitleTrack[] = [];
        for (let i = 0; i < el.textTracks.length; i++) {
          const t = el.textTracks[i];
          if (t && t.label) {
            embedded.push({ lang: t.label, url: "", format: "vtt", default: t.language === "en" || i === 0 });
          }
        }
        if (embedded.length > 0) {
          setIntSubs(prev => {
            const existing = new Set(prev.map(s => s.lang.toLowerCase()));
            const newOnes = embedded.filter(s => !existing.has(s.lang.toLowerCase()));
            if (newOnes.length > 0) {
              console.log('[DSP] Found ' + newOnes.length + ' embedded textTracks: ' + newOnes.map(s => s.lang).join(', '));
              return [...prev, ...newOnes];
            }
            return prev;
          });
        }
      }
    };
    const iv = setInterval(check, 800);
    setTimeout(() => clearInterval(iv), 8000);
    return () => clearInterval(iv);
  }, [streamUrl]);

  /** Parse HLS master manifest for real subtitle .vtt URLs */
  useEffect(() => {
    const isHls = streamType === "hls" || streamUrl.includes(".m3u8") || streamUrl.includes("proxy-stream");
    if (!isHls || !streamUrl) return;
    let cancelled = false;
    const fetchManifest = async () => {
      try {
        console.log('[DSP] Fetching HLS manifest for subtitle URLs: ' + streamUrl);
        const res = await fetch(streamUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) { console.warn('[DSP] Manifest fetch failed: ' + res.status); return; }
        const text = await res.text();
        console.log('[DSP] Manifest response (' + text.length + ' bytes)');
        // Parse for EXT-X-MEDIA:TYPE=SUBTITLES
        // Format: #EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs_en.m3u8"
        const subRe = /#EXT-X-MEDIA:TYPE=SUBTITLES[^]*?URI="([^"]+)"/g;
        const langRe = /NAME="([^"]+)"/g;
        const langRe2 = /LANGUAGE="([^"]+)"/g;
        const subs: SubtitleTrack[] = [];
        let match;
        // Reset lastIndex
        subRe.lastIndex = 0;
        let lastName = '';
        let urlMatch;
        while ((urlMatch = subRe.exec(text)) !== null) {
          const fullMatch = urlMatch[0];
          const uri = urlMatch[1];
          const nameMatch = fullMatch.match(/NAME="([^"]+)"/);
          const langMatch = fullMatch.match(/LANGUAGE="([^"]+)"/);
          const name = nameMatch ? nameMatch[1] : (langMatch ? langMatch[1] : 'Unknown');
          subs.push({
            lang: name,
            url: resolveUrl(uri, streamUrl),
            format: "vtt",
            default: name.toLowerCase().includes('english') || name.toLowerCase().includes('en'),
          });
        }
        if (subs.length > 0) {
          console.log('[DSP] Parsed ' + subs.length + ' subtitle tracks from manifest: ' + subs.map(s => s.lang).join(', '));
          setIntSubs(prev => {
            const existing = new Set(prev.map(s => s.lang.toLowerCase()));
            const newOnes = subs.filter(s => !existing.has(s.lang.toLowerCase()));
            if (newOnes.length > 0) return [...prev, ...newOnes];
            return prev;
          });
        } else {
          console.log('[DSP] No EXT-X-MEDIA:SUBTITLES found in manifest');
        }
      } catch (e) {
        console.warn('[DSP] HLS manifest subtitle parsing error:', e);
      }
    };
    // Small delay to let HLS.js process first
    const timeout = setTimeout(fetchManifest, 2000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [streamUrl, streamType]);

/** Resolve a relative URI against a base URL */
function resolveUrl(uri: string, base: string): string {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
  try {
    const baseUrl = new URL(base);
    // If URI is absolute path, use origin
    if (uri.startsWith('/')) return baseUrl.origin + uri;
    // Otherwise resolve relative to base
    return new URL(uri, base).href;
  } catch {
    // Fallback: try to use the base URL's directory
    const lastSlash = base.lastIndexOf('/');
    if (lastSlash > 0) return base.substring(0, lastSlash + 1) + uri;
    return uri;
  }
}
  useEffect(() => { const el = vr.current; if (!el) return; for (let i = 0; i < el.textTracks.length; i++) { const t = el.textTracks[i]; if (t) t.mode = selSub && t.label === selSub ? "showing" : "hidden"; } }, [selSub, allSubs]);
  const hSubSel = useCallback((lang: string | null) => setSelSub(lang), []);
  const hSubChg = useCallback((t: SubtitleTrack[]) => { setIntSubs(t); if (onSubtitlesChange) onSubtitlesChange(t); }, [onSubtitlesChange]);
  if (!streamUrl) return <div className="h-full w-full bg-black flex justify-center items-center text-white">Loading Stream...</div>;
  return (
    <div className="relative h-full w-full bg-black group">
      <video ref={vr} className="h-full w-full bg-black object-contain" controls autoPlay playsInline crossOrigin="anonymous" style={{ "--cue-font-size": "1rem" } as React.CSSProperties}>{subTracks}</video>
      <div className="absolute bottom-16 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} imdbId={imdbId} />
      </div>
    </div>
  );
}
