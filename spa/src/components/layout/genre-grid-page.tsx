import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getVideosByGenre, tmdbMediaToVideo } from '@/lib/api';
import type { Video } from '@/lib/data';
import { VideoCard } from '@/components/video/video-card';
import { Skeleton } from '@/components/ui/skeleton';

export function GenreGridPage({ mediaType }: { mediaType: 'movie' | 'tv' | 'anime' }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const genreId = params.get('id');
  const genreName = params.get('name') || '';
  const isKeyword = params.get('is_keyword') === '1';

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is the Adult Animation genre page
  const isAdultAnimationGenre = mediaType === 'tv' && genreId === '16-adult';
  const isRegularAnimationGenre = mediaType === 'tv' && genreId === '16';

  useEffect(() => {
    let cancelled = false;
    async function fetchGenre() {
      setLoading(true);
      setError(null);
      let page = 1;
      const results: Video[] = [];
      const seen = new Set<string>();
      try {
        while (results.length < 40 && page <= 5) {
          let raw;
          try {
            // For Adult Animation, fetch from regular animation genre but filter explicitly
            const fetchGenreId = isAdultAnimationGenre ? '16' : genreId;
            raw = await getVideosByGenre(fetchGenreId!, mediaType, isKeyword, page);
          } catch (fetchErr: any) {
            console.error('[GENRE GRID] Failed to fetch page', page, 'for', genreId, 'mediaType', mediaType, fetchErr);
            setError(`Failed to fetch data (page ${page}).`);
            break;
          }
          if (!raw || raw.length === 0) break;
          for (const basic of raw) {
            const key = `${mediaType}-${basic.id}`;
            if (seen.has(key)) continue;
            try {
              const enriched = await tmdbMediaToVideo(basic);
              if (enriched) {
                // Filtering rules:
                // - Exclude explicit for anime
                // - Exclude NR for movies
                // - For regular Animation genre: exclude explicit AND exclude asian/russian languages
                // - For Adult Animation genre: ONLY include explicit AND exclude asian/russian languages
                
                if (mediaType === 'anime' && enriched.is_explicit) continue;
                if (mediaType === 'movie' && enriched.rating === 'NR') continue;
                
                // Handle Animation genre special cases for TV
                if (mediaType === 'tv' && (isAdultAnimationGenre || isRegularAnimationGenre)) {
                  const asianOrRussianLanguages = ['ja', 'ko', 'zh', 'ru'];
                  
                  // Skip if has asian/russian language (belongs on Anime page)
                  if (asianOrRussianLanguages.includes(enriched.original_language || '')) {
                    continue;
                  }
                  
                  // For Adult Animation: ONLY include explicit content
                  if (isAdultAnimationGenre && !enriched.is_explicit) {
                    continue;
                  }
                  
                  // For Regular Animation: ONLY include non-explicit content
                  if (isRegularAnimationGenre && enriched.is_explicit) {
                    continue;
                  }
                }
                
                results.push(enriched);
                seen.add(key);
              }
            } catch (e) {
              console.error('[GENRE GRID] Failed to enrich video', basic?.id, e);
            }
            if (results.length >= 40) break;
          }
          page++;
        }
      } catch (e: any) {
        console.error('[GENRE GRID] Unexpected error:', e);
        setError('Unexpected error while fetching genre data.');
      }
      if (!cancelled) {
        setVideos(results);
        setLoading(false);
      }
    }
    if (genreId) fetchGenre();
    else setError('No genre specified');
    return () => { cancelled = true; };
  }, [genreId, genreName, isKeyword, mediaType, isAdultAnimationGenre, isRegularAnimationGenre]);

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-red-500">{genreName || 'Genre'}</h1>
      {error && (
        <div className="p-4 mb-6 rounded bg-red-600/10 border border-red-600/20 text-red-500">
          <strong>Error:</strong> {error}
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {videos.map(video => (
            <VideoCard key={`${video.media_type}-${video.id}`} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
