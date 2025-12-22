'use client';

import React from 'react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { WatchProgress, Video } from '@/lib/data';
import { useDismissed } from '@/context/dismissed-context';
import { VideoCard } from './video-card';
import { SkipForward, Play } from 'lucide-react';
import { AddToWatchlistButton } from './add-to-watchlist-button';
import { DismissButton } from './dismiss-button';

// Helper to determine the next episode
const getNextEpisode = (item: WatchProgress) => {
    if (!item || (item.type !== 'tv' && item.type !== 'anime')) {
        return null;
    }

    const currentSeasonNum = parseInt(item.last_season_watched || '1', 10);
    const currentEpisodeNum = parseInt(item.last_episode_watched || '1', 10);
    
    // For anime with a flat episode list
    if (item.type === 'anime' && item.episodes && (!item.seasons || item.seasons.length === 0)) {
        if (currentEpisodeNum < item.episodes) {
            return { season: currentSeasonNum, episode: currentEpisodeNum + 1 };
        }
        return null;
    }
    
    const seasons = item.seasons?.filter(s => s.season_number > 0).sort((a,b) => a.season_number - b.season_number) || [];
    const currentSeasonData = seasons.find(s => s.season_number === currentSeasonNum);

    if (currentSeasonData && currentEpisodeNum < currentSeasonData.episode_count) {
        // Next episode in the same season
        return { season: currentSeasonNum, episode: currentEpisodeNum + 1 };
    } else {
        // Find next season with episodes
        const currentSeasonIndex = seasons.findIndex(s => s.season_number === currentSeasonNum);
        if (currentSeasonIndex !== -1 && currentSeasonIndex < seasons.length - 1) {
            const nextSeason = seasons[currentSeasonIndex + 1];
            if (nextSeason && nextSeason.episode_count > 0) {
                return { season: nextSeason.season_number, episode: 1 };
            }
        }
    }

    return null;
}


export function WatchHistoryCard({ item }: { item: WatchProgress }) {
  const { dismissedItems } = useDismissed();
  const percentage = (item.progress.watched / item.progress.duration) * 100;

  const getWatchHref = () => {
    if (item.type === 'movie') {
        return `/watch?id=${item.id}&type=movie`;
    }
    const season = item.last_season_watched || '1';
    const episode = item.last_episode_watched || '1';
    return `/watch?id=${item.id}&type=${item.type}&s=${season}&e=${episode}`;
  };

  const watchHref = getWatchHref();
  const nextEpisode = getNextEpisode(item);

  const video: Video = {
    id: String(item.id),
    mal_id: item.mal_id,
    media_type: item.type,
    title: item.title,
    description: '',
    categories: [],
    thumbnailSeed: '',
    poster_path: item.poster_path,
    rating: item.rating,
    seasons: item.seasons,
    episodes: item.episodes,
  };
  
  const dismissedKey = `${video.media_type}-${video.id}`;
  if (dismissedItems[dismissedKey]) {
    return null;
 }

  return (
    <div className="relative group overflow-visible block"> {/* allow overlays/tooltips to escape card */}
      <Link href={watchHref}>
        <div>
          <VideoCard video={video} watchHref={watchHref} />
        </div>
      </Link>

      {/* Top-right small controls, same as other card hovers */}
      <div className="absolute top-2 right-2 z-50 flex flex-col items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
        <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e:any)=>{ e.stopPropagation(); }}>
          <Link href={watchHref}>
            <Play className="h-4 w-4" />
          </Link>
        </Button>
        <AddToWatchlistButton video={video} />
        <DismissButton video={video} onDismiss={() => {}} />
      </div>

      {/* Current episode badge - center bottom above next-episode button */}
      {item.type !== 'movie' && (
        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-16 z-50 pointer-events-none text-center w-full max-w-[160px]">
          <div className="bg-black/80 px-3 py-1 rounded-md mx-auto inline-block text-center">
            <div className="text-xs text-muted-foreground">Continue Watching</div>
            <div className="text-sm font-semibold text-white">{`S${item.last_season_watched || '?'}E${item.last_episode_watched || '?'}`}</div>
          </div>
        </div>
      )}

      {/* Progress bar at very bottom (inside card) */}
      <div className="absolute bottom-0 w-full px-2 pointer-events-none" style={{transform: 'translateY(1px)'}}>
          <Progress value={percentage} className="h-1 bg-black/50" />
      </div>

      {/* Next episode button shown below card area if available (keeps layout consistent) */}
      {nextEpisode && (
        <div className="mt-2 space-y-1 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div />
            <Button asChild variant="ghost" size="sm" className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-primary hover:bg-transparent">
              <Link href={`/watch?id=${video.id}&type=${video.media_type}&s=${nextEpisode.season}&e=${nextEpisode.episode}`}>
                Next Ep <SkipForward className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
