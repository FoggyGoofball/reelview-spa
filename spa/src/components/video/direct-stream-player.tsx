"use client";
import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Hls from "hls.js";
import type { Video } from "@/lib/data";
import { saveWatchProgress } from "@/lib/client-api";
import { SubtitleSelector } from "./subtitle-selector";
import { toStreamWorkerUrl, shouldUseStreamWorker, getWorkerStatus } from "@/lib/stream-worker";

const LOG_PREFIX = '[DirectStreamPlayer]';

function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

export interface SubtitleTrack { lang: string; url: string; format: "vtt" | "srt" | "ass"; default?: boolean; }
interface P { video: Video; streamUrl: string; streamType: "hls" | "mp4" | "mkv"; season?: number; episode?: number; subtitles?: SubtitleTrack[]; onSubtitlesChange?: (t: SubtitleTrack[]) => void; tmdbId?: string; title?: string; imdbId?: string; }

/** Backend domains whose proxy URLs should always be used as-is (not sent to SW) */
const PROXY_DOMAINS = ['reelview-spa.onrender.com'];

/**
 * Convert a URL to a stream worker URL if applicable.
 *
 * Rule: if the URL is already proxied through one of our backend domains,
 * use it as-is — the proxy already handles CORS, and extracting the raw
 * CDN URL would cause the service worker to attempt a cross-origin fetch
 * that the CDN may not allow (CORS error → 502).
 */
function convertToWorkerUrl(originalUrl: string): string {
  log('DEBUG', 'Converting URL', { originalUrl });

  // ── Already proxied through backend → skip SW conversion ──
  try {
    const parsed = new URL(originalUrl);
    if (PROXY_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
      log('INFO', 'URL already proxied through backend, using as-is');
      return originalUrl;
    }
  } catch {
    // invalid URL, fall through
  }

  // ── Direct source URL that should use the worker ──
  if (shouldUseStreamWorker(originalUrl)) {
    const workerUrl = toStreamWorkerUrl(originalUrl);
    log('INFO', 'Converting direct URL to worker URL', { workerUrl });
    return workerUrl;
  }

  log('DEBUG', 'URL does not need conversion', { originalUrl });
  return originalUrl;
}

export function DirectStreamPlayer({ video, streamUrl, streamType, season, episode, subtitles: extSubs, onSubtitlesChange, tmdbId, title, imdbId }: P) {
  const vr = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selSub, setSelSub] = useState<string | null>(null);
  const [intSubs, setIntSubs] = useState<SubtitleTrack[]>([]);
  const [activeUrl, setActiveUrl] = useState<string>(streamUrl);
  const allSubs = intSubs.length > 0 ? intSubs : (extSubs || []);
  
  // Log component mount
  useEffect(() => {
    log('INFO', 'DirectStreamPlayer mounted', {
      videoId: video?.id,
      streamUrl,
      streamType,
      season,
      episode
    });
    
    return () => {
      log('INFO', 'DirectStreamPlayer unmounting');
    };
  }, []);
  
  // Convert URL when streamUrl changes
  useEffect(() => {
    log('INFO', 'Stream URL changed', { streamUrl });
    
    const workerStatus = getWorkerStatus();
    log('INFO', 'Worker status', { workerStatus });
    
    if (workerStatus.active) {
      const convertedUrl = convertToWorkerUrl(streamUrl);
      log('INFO', 'Using converted URL', { convertedUrl });
      setActiveUrl(convertedUrl);
    } else {
      log('WARN', 'Worker not active, using original URL');
      setActiveUrl(streamUrl);
    }
  }, [streamUrl]);
  
  useEffect(() => { 
    if (!video) return; 
    const iv = setInterval(() => { 
      const v = vr.current; 
      if (!v) return; 
      saveWatchProgress({ 
        id: video.id, 
        mal_id: video.mal_id, 
        type: video.media_type, 
        title: video.title, 
        poster_path: video.poster_path, 
        progress: { 
          watched: v.currentTime || 0, 
          duration: v.duration || 0 
        }, 
        last_season_watched: String(season), 
        last_episode_watched: String(episode), 
        last_updated: Date.now(), 
        rating: video.rating, 
        seasons: video.seasons, 
        episodes: video.episodes 
      }); 
    }, 15000); 
    return () => clearInterval(iv); 
  }, [video, season, episode]);
  
  const subTracks = useMemo(() => { 
    if (!allSubs || allSubs.length === 0) return null; 
    return allSubs.map((sub, idx) => { 
      const k = sub.format === "ass" ? "metadata" : "subtitles"; 
      const sl = sub.lang === "English" ? "en" : sub.lang.substring(0, 2).toLowerCase(); 
      return <track key={"sub-" + idx} src={sub.url} kind={k} srcLang={sl} label={sub.lang} default={selSub === sub.lang || (sub.default || idx === 0)} />; 
    }); 
  }, [allSubs, selSub]);
  
  useEffect(() => { 
    const el = vr.current; 
    if (!el || !activeUrl) {
      log('WARN', 'Video element or URL not ready', { hasElement: !!el, hasUrl: !!activeUrl });
      return; 
    } 
    
    log('INFO', 'Setting up video player', { 
      activeUrl, 
      streamType,
      isHls: streamType === "hls" || activeUrl.includes(".m3u8") || activeUrl.includes("proxy-stream") || activeUrl.includes("/stream/")
    });
    
    if (hlsRef.current) { 
      log('INFO', 'Destroying existing HLS instance');
      hlsRef.current.destroy(); 
      hlsRef.current = null; 
    } 
    
    const isHls = streamType === "hls" || activeUrl.includes(".m3u8") || activeUrl.includes("proxy-stream") || activeUrl.includes("/stream/"); 
    
    if (isHls) { 
      log('INFO', 'Setting up HLS playback');
      
      if (el.canPlayType("application/vnd.apple.mpegurl")) { 
        log('INFO', 'Using native HLS support');
        el.src = activeUrl; 
        el.play().catch((err) => {
          log('ERROR', 'Native HLS play failed', { error: err.message });
        }); 
      } else if (Hls.isSupported()) { 
        log('INFO', 'Using HLS.js');
        const hls = new Hls({ 
          enableWorker: true, 
          lowLatencyMode: false, 
          maxBufferLength: 30, 
          startLevel: -1 
        }); 
        hlsRef.current = hls; 
        
        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          log('INFO', 'HLS manifest loading');
        });
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => { 
          log('INFO', 'HLS manifest parsed, starting playback');
          el.play().catch((err) => {
            log('ERROR', 'HLS.js play failed', { error: err.message });
          }); 
        }); 
        
        hls.on(Hls.Events.ERROR, (_e, d) => { 
          log('ERROR', 'HLS error', { 
            type: d.type,
            details: d.details,
            fatal: d.fatal,
            error: d.error?.message
          });
          
          if (d.fatal) { 
            switch (d.type) { 
              case Hls.ErrorTypes.NETWORK_ERROR: 
                log('WARN', 'Network error, attempting recovery');
                hls.startLoad(); 
                break; 
              case Hls.ErrorTypes.MEDIA_ERROR: 
                log('WARN', 'Media error, attempting recovery');
                hls.recoverMediaError(); 
                break; 
              default: 
                log('ERROR', 'Fatal error, destroying HLS instance');
                hls.destroy(); 
                hlsRef.current = null; 
            } 
          } 
        }); 
        
        hls.loadSource(activeUrl); 
        hls.attachMedia(el); 
      } else { 
        log('ERROR', 'HLS not supported in this browser'); 
      } 
    } else { 
      log('INFO', 'Using direct video playback');
      el.src = activeUrl; 
      el.play().catch((err) => {
        log('ERROR', 'Direct play failed', { error: err.message });
      }); 
    } 
    
    return () => { 
      if (hlsRef.current) { 
        log('INFO', 'Cleaning up HLS instance');
        hlsRef.current.destroy(); 
        hlsRef.current = null; 
      } 
      if (el) { 
        el.removeAttribute("src"); 
        el.load(); 
      } 
    }; 
  }, [activeUrl, streamType]);
  
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
              log('INFO', 'Found embedded subtitle tracks', { 
                count: newOnes.length, 
                languages: newOnes.map(s => s.lang) 
              });
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
  }, [activeUrl]);

  /** Parse HLS master manifest for real subtitle .vtt URLs */
  useEffect(() => {
    const isHls = streamType === "hls" || activeUrl.includes(".m3u8") || activeUrl.includes("proxy-stream") || activeUrl.includes("/stream/");
    if (!isHls || !activeUrl) return;
    let cancelled = false;
    const fetchManifest = async () => {
      try {
        log('INFO', 'Fetching HLS manifest for subtitle URLs', { activeUrl });
        const res = await fetch(activeUrl, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) { 
          log('WARN', 'Manifest fetch failed', { status: res.status }); 
          return; 
        }
        const text = await res.text();
        log('INFO', 'Manifest fetched', { size: text.length });
        
        // Parse for EXT-X-MEDIA:TYPE=SUBTITLES
        const subRe = /#EXT-X-MEDIA:TYPE=SUBTITLES[^]*?URI="([^"]+)"/g;
        const subs: SubtitleTrack[] = [];
        let urlMatch;
        subRe.lastIndex = 0;
        
        while ((urlMatch = subRe.exec(text)) !== null) {
          const fullMatch = urlMatch[0];
          const uri = urlMatch[1];
          const nameMatch = fullMatch.match(/NAME="([^"]+)"/);
          const langMatch = fullMatch.match(/LANGUAGE="([^"]+)"/);
          const name = nameMatch ? nameMatch[1] : (langMatch ? langMatch[1] : 'Unknown');
          
          subs.push({
            lang: name,
            url: resolveUrl(uri, activeUrl),
            format: "vtt",
            default: name.toLowerCase().includes('english') || name.toLowerCase().includes('en'),
          });
        }
        
        if (subs.length > 0) {
          log('INFO', 'Parsed subtitle tracks from manifest', { 
            count: subs.length, 
            languages: subs.map(s => s.lang) 
          });
          setIntSubs(prev => {
            const existing = new Set(prev.map(s => s.lang.toLowerCase()));
            const newOnes = subs.filter(s => !existing.has(s.lang.toLowerCase()));
            if (newOnes.length > 0) return [...prev, ...newOnes];
            return prev;
          });
        } else {
          log('INFO', 'No EXT-X-MEDIA:SUBTITLES found in manifest');
        }
      } catch (e: any) {
        log('ERROR', 'HLS manifest subtitle parsing error', { error: e.message });
      }
    };
    
    const timeout = setTimeout(fetchManifest, 2000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [activeUrl, streamType]);

  /** Resolve a relative URI against a base URL */
  function resolveUrl(uri: string, base: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    try {
      const baseUrl = new URL(base);
      if (uri.startsWith('/')) return baseUrl.origin + uri;
      return new URL(uri, base).href;
    } catch {
      const lastSlash = base.lastIndexOf('/');
      if (lastSlash > 0) return base.substring(0, lastSlash + 1) + uri;
      return uri;
    }
  }
  
  useEffect(() => { 
    const el = vr.current; 
    if (!el) return; 
    for (let i = 0; i < el.textTracks.length; i++) { 
      const t = el.textTracks[i]; 
      if (t) t.mode = selSub && t.label === selSub ? "showing" : "hidden"; 
    } 
  }, [selSub, allSubs]);
  
  const hSubSel = useCallback((lang: string | null) => {
    log('INFO', 'Subtitle selection changed', { lang });
    setSelSub(lang);
  }, []);
  
  const hSubChg = useCallback((t: SubtitleTrack[]) => { 
    log('INFO', 'Subtitles changed', { count: t.length });
    setIntSubs(t); 
    if (onSubtitlesChange) onSubtitlesChange(t); 
  }, [onSubtitlesChange]);
  
  if (!activeUrl) {
    log('WARN', 'No active URL, showing loading state');
    return <div className="h-full w-full bg-black flex justify-center items-center text-white">Loading Stream...</div>;
  }
  
  return (
    <div className="relative h-full w-full bg-black group">
      <video ref={vr} className="h-full w-full bg-black object-contain" controls autoPlay playsInline crossOrigin="anonymous" style={{ "--cue-font-size": "1rem" } as React.CSSProperties}>{subTracks}</video>
      <div className="absolute bottom-16 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <SubtitleSelector videoRef={vr} subtitles={allSubs} selectedSubtitle={selSub} onSubtitleSelect={hSubSel} onSubtitlesChange={hSubChg} tmdbId={tmdbId} season={season} episode={episode} title={title} imdbId={imdbId} />
      </div>
    </div>
  );
}