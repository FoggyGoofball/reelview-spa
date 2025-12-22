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
            raw = await getVideosByGenre(genreId!, mediaType, isKeyword, page);
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
                if (mediaType === 'anime' && enriched.is_explicit) continue;
                if (mediaType === 'movie' && enriched.rating === 'NR') continue;
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
  }, [genreId, genreName, isKeyword, mediaType]);

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
