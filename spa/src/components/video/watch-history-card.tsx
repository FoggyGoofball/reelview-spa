"use client";

import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import type { WatchProgress } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { AddToWatchlistButton } from './add-to-watchlist-button';
import { DismissButton } from './dismiss-button';

export interface WatchHistoryCardProps {
  item: WatchProgress;
  variant?: "default" | "compact";
}

export function WatchHistoryCard({
  item,
  variant = "default",
}: WatchHistoryCardProps) {
  const navigate = useNavigate();

  const posterUrl = item.poster_path
    ? item.poster_path.startsWith("http")
      ? item.poster_path
      : `https://image.tmdb.org/t/p/w342${item.poster_path}`
    : "https://picsum.photos/seed/default-poster/342/513";

  const isSeries = item.type === "tv" || item.type === "anime";

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = isSeries
      ? `/watch?id=${item.id}&type=${item.type}&s=${item.last_season_watched || 1}&e=${item.last_episode_watched || 1}`
      : `/watch?id=${item.id}&type=${item.type}`;
    navigate(url);
  };

  // For continue-watching carousel, clicking the card should go directly to the watch page
  const handleCardClick = () => {
    const url = isSeries
      ? `/watch?id=${item.id}&type=${item.type}&s=${item.last_season_watched || 1}&e=${item.last_episode_watched || 1}`
      : `/watch?id=${item.id}&type=${item.type}`;
    navigate(url);
  };

  const percentage = item.progress
    ? (item.progress.watched / item.progress.duration) * 100
    : 0;

  // compute current and next episode if series
  const currSeason = isSeries && item.last_episode_watched
    ? Number(item.last_season_watched || 1)
    : undefined;
  const currEpisode = isSeries && item.last_episode_watched
    ? Number(item.last_episode_watched)
    : undefined;

  let nextSeason: number | null = null;
  let nextEpisode: number | null = null;
  let hasNext = false;

  if (isSeries && currEpisode !== undefined) {
    let tentativeNextSeason = currSeason || 1;
    let tentativeNextEpisode = (currEpisode || 0) + 1;

    if (item.seasons && item.seasons.length > 0) {
      const currentSeasonData = item.seasons.find(
        (s) => s.season_number === (currSeason || 1)
      );
      if (currentSeasonData) {
        if (tentativeNextEpisode > currentSeasonData.episode_count) {
          const currentIndex = item.seasons.findIndex(
            (s) => s.season_number === (currSeason || 1)
          );
          const nextSeasonData = item.seasons[currentIndex + 1];
          if (nextSeasonData) {
            tentativeNextSeason = nextSeasonData.season_number;
            tentativeNextEpisode = 1;
            hasNext = true;
          } else {
            hasNext = false;
          }
        } else {
          hasNext = true;
        }
      } else {
        hasNext = true;
      }
    } else {
      hasNext = true;
    }

    if (hasNext) {
      nextSeason = tentativeNextSeason;
      nextEpisode = tentativeNextEpisode;
    }
  }

  const formatEp = (s?: number | null, e?: number | null) => {
    if (s == null || e == null) return "";
    return `S${s}E${e}`;
  };

  // next episode href
  const nextEpisodeHref =
    hasNext && nextEpisode != null && nextSeason != null
      ? `/watch?id=${item.id}&type=${item.type}&s=${nextSeason}&e=${nextEpisode}`
      : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-muted cursor-pointer transition-all hover:shadow-xl hover:scale-105",
        variant === "compact" && "w-24"
      )}
      onClick={handleCardClick}
    >
      <div className="relative h-full w-full aspect-[2/3]">
        <img
          src={posterUrl}
          alt={`Poster for ${item.title}`}
          className="w-full h-full object-cover"
        />

        {/* overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10" />

        {/* Current episode badge - separate entity on the poster */}
        {currSeason != null && currEpisode != null && (
          <div className="absolute left-3 top-3 z-30 pointer-events-auto">
            <div className="bg-black/70 px-3 py-1 rounded-md text-left">
              <div className="text-xs text-muted-foreground">Continue</div>
              <div className="text-sm font-semibold text-white">{formatEp(currSeason, currEpisode)}</div>
            </div>
          </div>
        )}

        {/* top-right full hover controls (Play, Watchlist, Dismiss) */}
        <div className="absolute top-2 right-2 z-40 flex flex-col items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e:any)=>{ e.stopPropagation(); handlePlayClick(e); }}>
            <Play className="h-4 w-4" />
          </Button>
          <AddToWatchlistButton video={{ id: String(item.id), mal_id: item.mal_id, media_type: item.type, title: item.title, description: '', categories: [], thumbnailSeed: '', poster_path: item.poster_path, rating: item.rating, seasons: item.seasons, episodes: item.episodes }} />
          <DismissButton video={{ id: String(item.id), mal_id: item.mal_id, media_type: item.type, title: item.title, description: '', categories: [], thumbnailSeed: '', poster_path: item.poster_path, rating: item.rating, seasons: item.seasons, episodes: item.episodes }} onDismiss={() => {}} />
        </div>

        {/* Age rating badge */}
        {item.rating && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/80 rounded px-2 py-1 z-30">
            <span className="text-xs font-semibold text-white">{item.rating}</span>
          </div>
        )}

        {/* progress bar */}
        {item.progress && item.progress.watched > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-600">
            <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
          </div>
        )}
      </div>

      {/* Watch Next button at bottom (separate entity) */}
      {nextEpisodeHref && (
        <div className="mt-2 px-2">
          <div className="mt-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(nextEpisodeHref);
              }}
              className="inline-flex items-center justify-center gap-2 bg-primary text-white px-4 h-10 rounded-md hover:opacity-90 w-full"
              title={`Watch next ${formatEp(nextSeason, nextEpisode)}`}
            >
              <span className="text-sm font-medium">Watch Next</span>
              <span className="text-sm font-semibold">
                {formatEp(nextSeason, nextEpisode)}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
