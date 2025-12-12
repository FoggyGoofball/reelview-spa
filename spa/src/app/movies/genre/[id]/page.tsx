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

const PAGE_ITEM_LIMIT = 30;

function MovieGenrePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { dismissedItems } = useDismissed();

  const genreId = params.id as string;
  const genreName = (searchParams.get('name') || 'Genre') as string;

  useEffect(() => {
    if (!genreId) return;

    const fetchGenreVideos = async () => {
      setIsLoading(true);
      setVideos([]);
      try {
        let page = 1;
        let processedVideos: Video[] = [];
        const processedIds = new Set<string>();

        while(processedVideos.length < PAGE_ITEM_LIMIT && page < 10) { // Limit to 10 pages to prevent infinite loops
            const rawMedia = await getVideosByGenre(genreId, 'movie', false, page);
            if (!rawMedia || rawMedia.length === 0) {
                break; // No more results from API
            }

            for (const basicVideo of rawMedia) {
                if (processedVideos.length >= PAGE_ITEM_LIMIT) break;

                const videoKey = `movie-${basicVideo.id}`;
                if (dismissedItems[videoKey] || processedIds.has(videoKey)) continue;
                
                processedIds.add(videoKey);

                const enrichedVideo = await tmdbMediaToVideo(basicVideo);
                if (enrichedVideo) {
                    processedVideos.push(enrichedVideo);
                }
            }
            page++;
        }
        setVideos(processedVideos);
      } catch (error) {
        console.error(`Failed to fetch movies for genre ${genreName}:`, error);
        toast({ variant: "destructive", title: `Failed to fetch videos`, description: `Could not load ${genreName} videos.` });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenreVideos();
  }, [genreId, genreName, dismissedItems, toast]);
  
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {videos.map(video => (
            <VideoCard key={`${video.media_type}-${video.id}`} video={video} />
          ))}
        </div>
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
