import { useNavigate } from 'react-router-dom';
import { Star, Plus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDismissed } from '@/context/dismissed-context';
import { useWatchlist } from '@/context/watchlist-context';
import type { Video } from '@/lib/data';
import { cn } from '@/lib/utils';

export interface VideoCardProps {
  video: Video;
  variant?: 'default' | 'compact';
  onDismiss?: (video: Video) => void;
}

export function VideoCard({ video, variant = 'default', onDismiss }: VideoCardProps) {
  const navigate = useNavigate();
  const { addToDismissed, isDismissed } = useDismissed();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlist();

  const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
  const posterUrl = video.poster_path
    ? video.poster_path.startsWith('http')
      ? video.poster_path
      : `https://image.tmdb.org/t/p/w342${video.poster_path}`
    : 'https://picsum.photos/seed/default-poster/342/513';

  const isVideoInWatchlist = isInWatchlist(video.id, video.media_type);
  const isVideoDismissed = isDismissed(video.id, video.media_type);

  const handleCardClick = () => {
    if (isSeries) {
      navigate(`/media/${video.media_type}/${video.id}`);
    } else {
      navigate(`/watch?id=${video.id}&type=${video.media_type}`);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = isSeries
      ? `/watch?id=${video.id}&type=${video.media_type}&s=1&e=1`
      : `/watch?id=${video.id}&type=${video.media_type}`;
    navigate(url);
  };

  const handleWatchlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVideoInWatchlist) {
      removeFromWatchlist(video.id, video.media_type);
    } else {
      addToWatchlist(video);
    }
  };

  const handleDismissClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToDismissed(video);
    if (onDismiss) {
      onDismiss(video);
    }
  };

  if (isVideoDismissed) {
    return null;
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden rounded-lg bg-muted cursor-pointer transition-all hover:shadow-xl hover:scale-105',
        variant === 'compact' && 'w-24'
      )}
      onClick={handleCardClick}
    >
      <CardContent className="p-0 relative h-full">
        <img
          src={posterUrl}
          alt={`Poster for ${video.title}`}
          className="w-full h-full object-cover"
          style={{ aspectRatio: '2/3' }}
        />
        {/* Dark gradient overlay - visible on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {variant !== 'compact' && (
          <>
            <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-gradient-to-t from-black to-transparent">
              <h3 className="text-sm font-semibold text-white line-clamp-2 mb-2">
                {video.title}
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={handlePlayClick}
                >
                  Play
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleWatchlistClick}
                >
                  {isVideoInWatchlist ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {video.vote_average > 0 && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/80 rounded px-2 py-1">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-semibold text-white">
                  {video.vote_average.toFixed(1)}
                </span>
              </div>
            )}

            {/* Dismiss button */}
            <button
              onClick={handleDismissClick}
              className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-6 w-6 text-white bg-black/50 rounded-full p-1 hover:bg-black/75" />
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
