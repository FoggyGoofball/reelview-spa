'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, memo } from 'react';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { VideoCarousel } from '@/components/video/video-carousel';
import { Clapperboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMedia } from '@/lib/tmdb';

const CAROUSEL_ITEM_LIMIT = 20;

const MemoizedVideoCarousel = memo(VideoCarousel);

export default function GenrePage() {
  const searchParams = useSearchParams();
  const genreId = searchParams.get('id');
  const genreName = searchParams.get('name');
  
  console.log('[Movies/Genre Page] Mounted - genreId:', genreId, 'genreName:', genreName);
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { dismissedItems } = useDismissed();

  const handleDismiss = useCallback((video: Video) => {
    setVideos(prev => prev.filter(v => v.id !== video.id || v.media_type !== video.media_type));
  }, []);

  useEffect(() => {
    if (!genreId) {
      console.warn('[Movies/Genre Page] No genreId found in params');
      setIsLoading(false);
      return;
    }

    const fetchGenreVideos = async () => {
      console.log('[Movies/Genre Page] Fetching videos for genre:', genreId);
      setIsLoading(true);
      try {
        let allVideos: Video[] = [];
        let page = 1;

        while (allVideos.length < CAROUSEL_ITEM_LIMIT && page <= 5) {
          const rawMedia: TMDBMedia[] = await getVideosByGenre(genreId, 'movie', false, page);
          if (!rawMedia || rawMedia.length === 0) {
            console.log('[Movies/Genre Page] No more results from API');
            break;
          }

          for (const item of rawMedia) {
            if (allVideos.length >= CAROUSEL_ITEM_LIMIT) break;
            const videoKey = `movie-${item.id}`;
            if (dismissedItems[videoKey]) continue;

            const enriched = await tmdbMediaToVideo(item);
            if (enriched) {
              allVideos.push(enriched);
            }
          }
          page++;
        }

        console.log('[Movies/Genre Page] Loaded videos:', allVideos.length);
        setVideos(allVideos);
      } catch (error) {
        console.error('[Movies/Genre Page] Failed to fetch genre videos:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load videos' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenreVideos();
  }, [genreId, dismissedItems, toast]);

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <Clapperboard className="h-8 w-8 text-primary" />
          {genreName ? decodeURIComponent(genreName) : 'Movies'}
        </h1>
      </div>
      
      {videos.length > 0 || isLoading ? (
        <MemoizedVideoCarousel 
          category={{ id: genreId || '', name: genreName ? decodeURIComponent(genreName) : 'Movies', is_keyword: false }} 
          videos={videos}
          isLoading={isLoading && videos.length === 0}
          onDismiss={handleDismiss}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No videos found for this genre.</p>
        </div>
      )}
    </div>
  );
}
