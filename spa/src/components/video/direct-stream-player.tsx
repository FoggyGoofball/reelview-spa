'use client';

import { useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import type { Video } from '@/lib/data';
import { saveWatchProgress } from '@/lib/client-api';

export interface SubtitleTrack {
  lang: string;
  url: string;
  format: 'vtt' | 'srt' | 'ass';
  default?: boolean;
}

interface DirectStreamPlayerProps {
  video: Video;
  streamUrl: string;
  streamType: 'hls' | 'mp4' | 'mkv';
  season?: number;
  episode?: number;
  subtitles?: SubtitleTrack[];
}

/**
 * DirectStreamPlayer — plays direct stream URLs (.m3u8, .mp4) using
 * HLS.js for HLS streams and native <video> for MP4/MKV.
 *
 * This replaces the iframe-based VidlinkPlayer when the ReelView Engine
 * returns direct stream URLs (wrapped through our /api/proxy-stream endpoint).
 */
export function DirectStreamPlayer({
  video,
  streamUrl,
  streamType,
  season,
  episode,
  subtitles,
}: DirectStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Watch progress tracking
  useEffect(() => {
    if (!video) return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      saveWatchProgress({
        id: video.id,
        mal_id: video.mal_id,
        type: video.media_type,
        title: video.title,
        poster_path: video.poster_path,
        progress: {
          watched: v.currentTime || 0,
          duration: v.duration || 0,
        },
        last_season_watched: String(season),
        last_episode_watched: String(episode),
        last_updated: Date.now(),
        rating: video.rating,
        seasons: video.seasons,
        episodes: video.episodes,
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [video, season, episode]);

  // Generate subtitle track elements for native <track> API
  const subtitleTracks = useMemo(() => {
    if (!subtitles || subtitles.length === 0) return null;
    return subtitles.map((sub, idx) => {
      // HLS.js handles its own subtitles from the manifest; we only add
      // <track> elements for MP4/MKV playback or HLS native (Safari).
      // For HLS.js, subtitles from the stream are handled internally.
      const kind = sub.format === 'ass' ? 'metadata' : 'subtitles';
      const srcLang = sub.lang === 'English' ? 'en' : sub.lang.substring(0, 2).toLowerCase();
      return (
        <track
          key={`sub-${idx}`}
          src={sub.url}
          kind={kind}
          srcLang={srcLang}
          label={sub.lang}
          default={sub.default || idx === 0}
        />
      );
    });
  }, [subtitles]);

  // Initialize HLS.js or native playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !streamUrl) return;

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls =
      streamType === 'hls' ||
      streamUrl.includes('.m3u8') ||
      streamUrl.includes('proxy-stream');

    if (isHls) {
      // Check if browser natively supports HLS (Safari, iOS)
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support — just set the src
        videoEl.src = streamUrl;
        videoEl.play().catch(() => {
          // Autoplay might be blocked — user needs to click play
        });
      } else if (Hls.isSupported()) {
        // Use HLS.js for browsers without native HLS support (Chrome, Firefox)
        const hls = new Hls({
          // Enable worker for better performance
          enableWorker: true,
          // Low latency mode for faster start
          lowLatencyMode: false,
          // Max buffer length for smoother playback
          maxBufferLength: 30,
          // Start at a reasonable quality
          startLevel: -1, // auto
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(videoEl);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoEl.play().catch(() => {
            // Autoplay might be blocked
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Try to recover network errors
                console.error('[HLS] Network error, attempting recovery:', data.details);
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Try to recover media errors
                console.error('[HLS] Media error, attempting recovery:', data.details);
                hls.recoverMediaError();
                break;
              default:
                // Unrecoverable error — destroy
                console.error('[HLS] Fatal error:', data.type, data.details);
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });
      } else {
        console.error('[DirectStreamPlayer] HLS not supported in this browser');
      }
    } else {
      // MP4 / MKV — native playback
      videoEl.src = streamUrl;
      videoEl.play().catch(() => {
        // Autoplay might be blocked
      });
    }

    // Cleanup on unmount or URL change
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoEl) {
        videoEl.removeAttribute('src');
        videoEl.load();
      }
    };
  }, [streamUrl, streamType]);

  if (!streamUrl) {
    return (
      <div className="h-full w-full bg-black flex justify-center items-center text-white">
        Loading Stream...
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full bg-black"
      controls
      autoPlay
      playsInline
      crossOrigin="anonymous"
    >
      {subtitleTracks}
    </video>
  );
}
