'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { Play, Info } from 'lucide-react';
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
import { updateWatchPositionOnNavigate } from '@/lib/client-api';

interface VideoCardProps {
  video: Video;
  onDismiss?: (video: Video) => void;
  watchHref?: string; // Optional href for resuming playback directly
  allowOverflow?: boolean; // when true, allows overlays/tooltips to render outside poster
}

export function VideoCard({ video, onDismiss, watchHref, allowOverflow }: VideoCardProps) {
  const router = useRouter();
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

  // The primary action for the card: prefer details page unless an explicit watchHref is provided
  const primaryHref = watchHref ? watchHref : detailHref;

  const onCardClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    router.push(primaryHref);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // update history immediately so continue-watching carousels refresh
    const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
    updateWatchPositionOnNavigate(String(id), video.media_type, isSeries ? 1 : null, isSeries ? 1 : null, video.title);
    // navigate via router when clicked programmatically
    router.push(watchNowHref);
  };

  const handleDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(detailHref);
  };

  const handleDismiss = (v?: Video) => {
    // forward to optional onDismiss prop
    if (onDismiss && v) onDismiss(v);
  };

  return (
    <div className="group block relative">
      <div onClick={(e) => onCardClick(e)} className="block">
        <Card className={`border-2 border-transparent ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} group-hover:border-primary transition-all duration-300 transform group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20`}>
          <div className="aspect-[2/3] relative bg-secondary">
              <img
                  src={imageUrl}
                  alt={`Thumbnail for ${title}`}
                  className="object-cover w-full h-full"
                  data-ai-hint={'movie poster'}
              />
              {showRating && (
                  <Badge variant="destructive" className="absolute top-2 left-2 z-10 text-xs backdrop-blur-sm bg-black/50 text-white border-0">
                      {video.rating}
                  </Badge>
              )}
          </div>
        </Card>
      </div>
        <div className="absolute top-2 right-2 z-10 flex flex-col items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 p-1 rounded-lg">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e)=>{ e.stopPropagation(); handlePlayClick(e); }}>
                          <Play className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Watch Now</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Details button reinstated */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={(e)=>{ e.stopPropagation(); handleDetailsClick(e); }}>
                            <Info className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Details</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <AddToWatchlistButton video={video} />
            <DismissButton video={video} onDismiss={(v)=>handleDismiss(v)} />
        </div>
      <div className='mt-2 space-y-1'>
        <div onClick={(e)=>{ e.stopPropagation(); router.push(detailHref); }} className="block">
            <h3 className="text-sm font-medium text-foreground truncate transition-colors group-hover:text-primary">
              {title}
            </h3>
        </div>
      </div>
    </div>
  );
}
