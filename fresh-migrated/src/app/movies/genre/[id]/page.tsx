'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { VideoCard } from '@/components/video/video-card';
import { Clapperboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDismissed } from '@/context/dismissed-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

const PAGE_ITEM_LIMIT = 30;
const MAX_PAGES = 20;

function MovieGenrePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { dismissedItems } = useDismissed();

  const genreId = params.id as string;
  const genreName = (searchParams.get('name') || 'Genre') as string;

  const fetchGenreVideos = async (pageNum: number, append: boolean = false) => {
    if (!genreId) return;

    const isLoading = append ? setIsLoadingMore : setIsLoading;
    isLoading(true);

    try {
      let processedVideos: Video[] = append ? videos : [];
      let processedIds = append ? seenIds : new Set<string>();
      let itemsNeeded = PAGE_ITEM_LIMIT;
      let apiPage = pageNum;

      while(itemsNeeded > 0 && apiPage <= MAX_PAGES) {
        const rawMedia = await getVideosByGenre(genreId, 'movie', false, apiPage);
        if (!rawMedia || rawMedia.length === 0) {
          setHasMore(false);
          break;
        }

        for (const basicVideo of rawMedia) {
          if (itemsNeeded <= 0) break;

          const videoKey = `movie-${basicVideo.id}`;
          if (dismissedItems[videoKey] || processedIds.has(videoKey)) continue;
          
          processedIds.add(videoKey);

          const enrichedVideo = await tmdbMediaToVideo(basicVideo);
          if (enrichedVideo) {
            processedVideos.push(enrichedVideo);
            itemsNeeded--;
          }
        }
        apiPage++;
      }
      setVideos(processedVideos);
      setSeenIds(processedIds);
      setHasMore(itemsNeeded > 0 && apiPage <= MAX_PAGES);
    } catch (error) {
      console.error(`Failed to fetch movies for genre ${genreName}:`, error);
      toast({ variant: "destructive", title: `Failed to fetch videos`, description: `Could not load ${genreName} videos.` });
    } finally {
      isLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setSeenIds(new Set());
    setVideos([]);
    setHasMore(true);
    fetchGenreVideos(1, false);
  }, [genreId, genreName, dismissedItems, toast]);

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchGenreVideos(nextPage, true);
  };
  
  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Clapperboard className="h-8 w-8 text-primary" />
          {genreName}
        </h1>
      </div>
      
      {isLoading && videos.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {Array.from({ length: 18 }).map((_, i) => (
             <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="h-5 w-3/4 rounded-md" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10 mb-8">
            {videos.map(video => (
              <VideoCard key={`${video.media_type}-${video.id}`} video={video} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-12 mb-8">
              <Button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                size="lg"
                className="gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <span className="animate-spin">?</span>
                    Loading More...
                  </>
                ) : (
                  <>
                    Load More
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasMore && videos.length > 0 && (
            <div className="text-center mt-12 text-muted-foreground">
              No more {genreName.toLowerCase()} to load
            </div>
          )}
        </>
      )}
    </div>
  );
}


export default function MovieGenrePage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-black text-white">
                <Skeleton className="h-full w-full" />
            </div>
        }>
            <MovieGenrePageContent />
        </Suspense>
    )
}
