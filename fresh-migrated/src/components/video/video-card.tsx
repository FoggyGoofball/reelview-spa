
import Image from 'next/image';
import Link from 'next/link';
import type { Video } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { AddToWatchlistButton } from './add-to-watchlist-button';
import { DismissButton } from './dismiss-button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from '../ui/button';

interface VideoCardProps {
  video: Video;
  onDismiss?: (video: Video) => void;
  watchHref?: string; // Optional href for resuming playback directly
}

export function VideoCard({ video, onDismiss, watchHref }: VideoCardProps) {
  const title = video.title || video.name;
  
  const imageUrl = video.poster_path && video.poster_path.startsWith('http')
    ? video.poster_path
    : `https://image.tmdb.org/t/p/w500${video.poster_path}`;

  const id = video.id;

  const detailHref = `/media/${video.media_type}/${id}`;
  
  const showRating = video.rating && video.rating.trim() !== '';

  const getWatchNowHref = () => {
    if (watchHref) return watchHref; // Use provided resume link if available
    
    const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
    if (isSeries) {
      return `/watch?id=${id}&type=${video.media_type}&s=1&e=1`;
    }
    return `/watch?id=${id}&type=movie`;
  };
  const watchNowHref = getWatchNowHref();

  // The primary action for the card. For "Continue Watching", it's playing. For others, it's details.
  const primaryHref = watchHref || detailHref;

  return (
    <div className="group block relative">
      <Link href={primaryHref}>
        <Card className="overflow-hidden border-2 border-transparent group-hover:border-primary transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20">
          <div className="aspect-[2/3] relative bg-secondary">
              <Image
                  src={imageUrl}
                  alt={`Thumbnail for ${title}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  data-ai-hint={'movie poster'}
              />
              {showRating && (
                  <Badge variant="destructive" className="absolute top-2 left-2 z-10 text-xs backdrop-blur-sm bg-black/50 text-white border-0">
                      {video.rating}
                  </Badge>
              )}
          </div>
        </Card>
      </Link>
        <div className="absolute top-2 right-2 z-10 flex flex-col items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 p-1 rounded-lg">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20">
                          <Link href={watchNowHref} onClick={(e) => e.stopPropagation()}>
                              <Play className="h-5 w-5" />
                          </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Watch Now</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AddToWatchlistButton video={video} />
            <DismissButton video={video} onDismiss={onDismiss} />
        </div>
      <div className='mt-2 space-y-1'>
        <Link href={primaryHref} >
            <h3 className="text-sm font-medium text-foreground truncate transition-colors group-hover:text-primary">
            {title}
            </h3>
        </Link>
      </div>
    </div>
  );
}
