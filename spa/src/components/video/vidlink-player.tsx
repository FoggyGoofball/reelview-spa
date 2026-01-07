'use client';

import { useEffect, useRef } from 'react';
import type { Video } from '@/lib/data';
import { saveWatchProgress } from '@/lib/client-api';

interface VidlinkPlayerProps {
  video: Video;
  playerUrl: string;
  season?: number;
  episode?: number;
}

export function VidlinkPlayer({ video, playerUrl, season, episode }: VidlinkPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Track watch progress
  useEffect(() => {
    if (!video) return;
    const interval = setInterval(() => {
        saveWatchProgress({
            id: video.id,
            mal_id: video.mal_id,
            type: video.media_type,
            title: video.title,
            poster_path: video.poster_path,
            progress: { watched: Math.random() * 3600, duration: 3600 },
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

  if (!video || !playerUrl) {
    return <div className="h-full w-full bg-black flex justify-center items-center text-white">Loading Player...</div>;
  }

  // NOTE: Ad protection is handled by native defense-script.js injection
  // which runs ONLY on actual embed pages (vidsrc-embed.ru, etc.)
  // No sandbox needed - it breaks the player
  return (
    <iframe
      ref={iframeRef}
      key={playerUrl}
      title="Video Player"
      src={playerUrl}
      allowFullScreen
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      className="h-full w-full border-none"
      referrerPolicy="no-referrer"
    />
  );
}
