'use client';

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, List, ArrowLeft, ExternalLink } from 'lucide-react';
import { SourceSelector } from '../layout/source-selector';
import type { Video } from '@/lib/data';
import { cn } from '@/lib/utils';
import { DownloadButton } from './download-button';

interface WatchHeaderProps {
  video: Video;
  currentSeason: number;
  currentEpisode: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenEpisodes: () => void;
  hasPrev: boolean;
  hasNext: boolean;
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

  // Suggested download filename prefilled from video + season/episode
  const suggestedFilename = isSeries
    ? `${video.title || video.name || 'series'}_S${String(currentSeason).padStart(2,'0')}E${String(currentEpisode).padStart(2,'0')}`
    : `${video.title || video.name || 'movie'}`;

  return (
    <header className={cn(
        "absolute top-0 left-0 right-0 z-30 p-4",
        "bg-gradient-to-b from-black/70 to-transparent",
        "flex items-center justify-between gap-4"
    )}>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate(`/media/${video.media_type}/${video.id}`)}>
            <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className='hidden md:block'>
            <h1 className="text-xl font-bold text-white truncate">{video.title}</h1>
            {isSeries && <p className="text-sm text-white/80">S{currentSeason}:E{currentEpisode}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {isSeries && (
           <div className="flex items-center gap-1 p-1 bg-black/30 rounded-full">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onPrev}
                    disabled={!hasPrev}
                    className="rounded-full text-white hover:bg-white/20 disabled:opacity-30"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenEpisodes}
                    className="rounded-full text-white hover:bg-white/20"
                >
                    <List className="h-6 w-6" />
                </Button>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNext}
                    disabled={!hasNext}
                    className="rounded-full text-white hover:bg-white/20 disabled:opacity-30"
                >
                    <ChevronRight className="h-6 w-6" />
                </Button>
           </div>
        )}
         <SourceSelector buttonVariant="secondary" />
         <DownloadButton suggestedFilename={suggestedFilename} />
         <Button variant="secondary" size="icon" title="Open in new tab" asChild>
            <a href={playerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-5 w-5" />
            </a>
          </Button>
      </div>
    </header>
  );
}
