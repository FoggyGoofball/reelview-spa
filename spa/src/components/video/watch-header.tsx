'use client';

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/video/download-button';
import type { Video } from '@/lib/data';

export interface WatchHeaderProps {
  video: Video;
  currentSeason: number;
  currentEpisode: number;
  onNext: () => void;
  onPrev: () => void;
  onOpenEpisodes: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  playerUrl: string;
}

export function WatchHeader({
  video,
  currentSeason,
  currentEpisode,
  onNext,
  onPrev,
  onOpenEpisodes,
  hasNext,
  hasPrev,
  playerUrl,
}: WatchHeaderProps) {
  const navigate = useNavigate();
  const isSeries = video.media_type === 'tv' || video.media_type === 'anime';

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4 text-white">
      <div className="container max-w-screen-2xl mx-auto flex items-center justify-between">
        {/* Back Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handleGoBack}
          className="rounded-full"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* Title and Info */}
        <div className="flex-1 px-4">
          <h1 className="text-xl font-bold text-white truncate">{video.title}</h1>
          {isSeries && (
            <p className="text-sm text-gray-300">
              Season {currentSeason}, Episode {currentEpisode}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <DownloadButton />
          {isSeries && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                disabled={!hasPrev}
                aria-label="Previous episode"
                className="inline-flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onOpenEpisodes(); }}
                aria-label="Select episode"
              >
                Episodes
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                disabled={!hasNext}
                aria-label="Next episode"
                className="inline-flex items-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
