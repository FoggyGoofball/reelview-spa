'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVideos, getPopularTvShows, getLatestAnime, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { Button } from '@/components/ui/button';
// DISABLE ALL CAROUSELS TO TEST
// import { VideoCarousel } from '@/components/video/video-carousel';
import { PlayCircle } from 'lucide-react';
import { ApiKeyNotice } from '@/components/api-key-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { useDismissed } from '@/context/dismissed-context';
import { TMDBMovie, TMDBTvShow } from '@/lib/tmdb';
import { cn } from '@/lib/utils';

console.log('[HOME] Home page loading...')

export default function Home() {
  console.log('[HOME] Rendering Home component')

  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [popularMovies, setPopularMovies] = useState<Video[]>([]);
  const [popularSeries, setPopularSeries] = useState<Video[]>([]);
  const [topAnime, setTopAnime] = useState<Video[]>([]);
  
  const [isLoadingMovies, setIsLoadingMovies] = useState(true);
  const [isLoadingSeries, setIsLoadingSeries] = useState(true);
  const [isLoadingAnime, setIsLoadingAnime] = useState(true);

  const [featuredVideo, setFeaturedVideo] = useState<Video | null>(null);
  const [isFeaturedLoading, setIsFeaturedLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [featuredPool, setFeaturedPool] = useState<Video[]>([]);

  const { dismissedItems } = useDismissed();

  useEffect(() => {
    console.log('[HOME] Mounting, checking API key...')
    setIsMounted(true);
    const key = localStorage.getItem('TMDB_API_KEY');
    setApiKey(key);
  }, []);

  const processMediaList = useCallback(async <T extends TMDBMovie | TMDBTvShow>(
    fetcher: () => Promise<T[] | null>,
    isAnime: boolean = false
  ): Promise<Video[]> => {
    try {
      const rawItems = await fetcher();
      if (!rawItems || rawItems.length === 0) {
        return [];
      }
      
      const enrichedItems = await Promise.all(
        rawItems.map(item => tmdbMediaToVideo(item))
      );

      const validItems = enrichedItems.filter((video): video is Video => !!video);
      
      return isAnime 
        ? validItems.filter(video => !video.is_explicit)
        : validItems;

    } catch (error) {
      console.error("[HOME] Failed to process media list", error);
      return [];
    }
  }, []);


  useEffect(() => {
    console.log('[HOME] Data fetch effect, apiKey:', !!apiKey, 'mounted:', isMounted)
    
    if (!apiKey || !isMounted) {
      if(isMounted) {
        setIsLoadingMovies(false);
        setIsLoadingSeries(false);
        setIsLoadingAnime(false);
        setIsFeaturedLoading(false);
      }
      return;
    }
    
    const fetchAllData = async () => {
        console.log('[HOME] Fetching all data...')
        setIsLoadingMovies(true);
        setIsLoadingSeries(true);
        setIsLoadingAnime(true);
        setIsFeaturedLoading(true);

        const [movies, series, anime] = await Promise.all([
            processMediaList(getVideos, false),
            processMediaList(getPopularTvShows, false),
            processMediaList(getLatestAnime, true)
        ]);

        console.log('[HOME] Data fetched - movies:', movies.length, 'series:', series.length, 'anime:', anime.length)

        setPopularMovies(movies);
        setPopularSeries(series);
        setTopAnime(anime);

        setIsLoadingMovies(false);
        setIsLoadingSeries(false);
        setIsLoadingAnime(false);

        const pool = [...movies.slice(0, 3), ...series.slice(0, 3), ...anime.slice(0,3)].filter(Boolean);
        
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        
        console.log('[HOME] Featured pool created with', pool.length, 'items')
        setFeaturedPool(pool);
        if (pool.length > 0) {
            setFeaturedVideo(pool[0]);
        }
        setIsFeaturedLoading(false);
    };

    fetchAllData();

  }, [apiKey, isMounted, processMediaList]);
  
  useEffect(() => {
    if (featuredPool.length <= 1) return;

    const intervalId = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setFeaturedVideo(current => {
          if (!current) return featuredPool[0];
          const validPool = featuredPool.filter(v => !dismissedItems[`${v.media_type}-${v.id}`]);
          if (validPool.length === 0) return null;
          
          const currentIndex = validPool.findIndex(v => v.id === current.id);
          const nextIndex = (currentIndex + 1) % validPool.length;
          return validPool[nextIndex];
        });
        setIsTransitioning(false);
      }, 1000);

    }, 18000);

    return () => clearInterval(intervalId);
  }, [featuredPool, dismissedItems]);

  if (!isMounted) {
    return (
       <div className="flex flex-col">
        <Skeleton className="h-[60vh] w-full" />
        <div className="container max-w-screen-2xl flex flex-col gap-8 md:gap-12 lg:gap-16 py-8 md:py-12">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyNotice />;
  }

  const currentFeaturedVideo = featuredVideo && !dismissedItems[`${featuredVideo.media_type}-${featuredVideo.id}`]
    ? featuredVideo
    : featuredPool.find(v => !dismissedItems[`${v.media_type}-${v.id}`]) || null;


  const getPlayHref = (video: Video) => {
    const isSeries = video.media_type === 'tv' || video.media_type === 'anime';
    return isSeries
      ? `/watch?id=${video.id}&type=${video.media_type}&s=1&e=1`
      : `/watch?id=${video.id}&type=${video.media_type}`;
  }

  return (
    <div className="flex flex-col bg-black">
      {isFeaturedLoading ? (
         <Skeleton className="h-[60vh] w-full" />
      ) : currentFeaturedVideo && (
        <div className="relative h-[60vh] w-full overflow-hidden">
          <img
            key={currentFeaturedVideo.id}
            src={`https://image.tmdb.org/t/p/w1280${currentFeaturedVideo.thumbnailSeed}`}
            alt={`Promotional image for ${currentFeaturedVideo.title}`}
            className={cn("w-full h-full object-cover transition-opacity duration-500", isTransitioning ? 'opacity-0' : 'opacity-100')}
            style={{ aspectRatio: '16/9' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-0 left-0 p-8 md:p-12 lg:p-16 w-full md:w-2/3 lg:w-1/2">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground drop-shadow-xl">
              {currentFeaturedVideo.title}
            </h1>
            {!currentFeaturedVideo.description ? (
                <Skeleton className='h-20 w-full mt-4' />
            ) : (
                <p className="mt-4 max-w-prose text-sm text-foreground/80 drop-shadow-lg line-clamp-3">
                  {currentFeaturedVideo.description}
                </p>
            )}
            <div className="mt-6">
              <Button size="lg" onClick={() => navigate(getPlayHref(currentFeaturedVideo))}>
                <PlayCircle className="mr-2 h-6 w-6" /> Play
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="container max-w-screen-2xl flex flex-col gap-8 md:gap-12 lg:gap-16 py-8 md:py-12">
        <p className="text-white text-lg">? Featured video + data fetching working!</p>
        <p className="text-white text-sm">Carousels temporarily disabled - one is causing 'd is not a function' error</p>
      </div>
    </div>
  );
}
