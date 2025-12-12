
import React from 'react';
import type { Category, Video } from '@/lib/data';
import { VideoCard } from './video-card';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '../ui/skeleton';
import Link from 'next/link';
import { ViewMoreCard } from './view-more-card';

interface VideoCarouselProps {
  category: Category;
  videos: Video[];
  isLoading?: boolean;
  onDismiss?: (video: Video) => void;
  href?: string;
  hasMore?: boolean;
}

function VideoCarouselComponent({ category, videos, isLoading, onDismiss, href, hasMore }: VideoCarouselProps) {
  
  const TitleContent = () => (
    <h2 id={`category-${category.id}-heading`} className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 group-hover:text-primary transition-colors">
      {category.name}
      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {(href) && <ChevronRight className="h-6 w-6 text-primary transition-transform group-hover:translate-x-1" />}
    </h2>
  );
  
  const actualHref = href 
    ? `${href}/${category.id}?name=${encodeURIComponent(category.name)}&is_keyword=${!!category.is_keyword}`
    : undefined;

  return (
    <section className="space-y-4" aria-labelledby={`category-${category.id}-heading`}>
      <div className="container max-w-screen-2xl">
        {actualHref ? (
           <Link href={actualHref} className="group inline-block">
            <TitleContent />
           </Link>
        ) : (
          <TitleContent />
        )}
      </div>
      <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 px-4 sm:px-6 lg:px-8">
            {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0 space-y-2")}>
                         <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                         <Skeleton className="h-5 w-3/4 rounded-md" />
                    </div>
                ))
            ) : (
              <>
                {videos.map((video) => (
                <div key={`${category.id}-${video.id}`} className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0")}>
                    <VideoCard video={video} onDismiss={onDismiss} />
                </div>
                ))}
                {hasMore && actualHref && (
                  <div className={cn("w-40 sm:w-48 md:w-56 flex-shrink-0")}>
                    <ViewMoreCard href={actualHref} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const VideoCarousel = React.memo(VideoCarouselComponent);
