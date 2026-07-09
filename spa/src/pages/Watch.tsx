'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Video, CustomVideoData } from '@/lib/data';
import { getAnimeEpisodes, type JikanEpisode } from '@/lib/jikan';
import { getTvSeasonDetails, type TMDBEpisode, type TMDBMedia } from '@/lib/tmdb';
import { tmdbMediaToVideo } from '@/lib/api';
import { getCustomVideoData, updateWatchPositionOnNavigate } from '@/lib/client-api';
import { Skeleton } from '@/components/ui/skeleton';
import { VidlinkPlayer } from '@/components/video/vidlink-player';
import { DirectStreamPlayer, type SubtitleTrack } from '@/components/video/direct-stream-player';
import { WatchHeader } from '@/components/video/watch-header';
import { EpisodeSelectionSheet } from '@/components/video/episode-selection-sheet';
import { useSource } from '@/context/source-context';
import { apiUrl } from '@/lib/api-base';
import type { ResolvedStream } from '@/components/video/stream-source-selector';

function WatchPageContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Parse query params from React Router location
  const params = new URLSearchParams(location.search);
  const tmdbId = params.get('id');
  const mediaType = params.get('type') as 'movie' | 'tv' | 'anime' | null;
  const initialSeason = params.get('s') ? parseInt(params.get('s') as string, 10) : undefined;
  const initialEpisode = params.get('e') ? parseInt(params.get('e') as string, 10) : undefined;

  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState(initialSeason || 1);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode || 1);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const resolveSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [animeEpisodeDetails, setAnimeEpisodeDetails] = useState<JikanEpisode[]>([]);
  const [tvSeasonDetails, setTvSeasonDetails] = useState<Record<number, TMDBEpisode[]>>({});
  const { source } = useSource();
  const [resolvedStreams, setResolvedStreams] = useState<ResolvedStream[]>([]);
  const [selectedStreamUrl, setSelectedStreamUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedSubtitles, setResolvedSubtitles] = useState<SubtitleTrack[]>([]);
  const [embedPlayerUrl, setEmbedPlayerUrl] = useState<string>('');
  const [selectedStreamType, setSelectedStreamType] = useState<string>('');

  // Direct URL from Search Direct Links modal
  const directUrlParam = params.get('directUrl');

  useEffect(() => {
    if (mediaType && mediaType !== 'movie' && (!initialSeason || !initialEpisode)) {
      navigate(`/watch?id=${tmdbId}&type=${mediaType}&s=1&e=1`);
    }
  }, [mediaType, initialSeason, initialEpisode, tmdbId, navigate]);

  const applyCustomData = useCallback((videoData: Video, customData: Record<string, CustomVideoData>) => {
    const videoKey = `${videoData.media_type}-${videoData.id}`;
    const custom = customData[videoKey];
    if (!custom) return videoData;

    const updatedVideo = { ...videoData };
    if (updatedVideo.media_type === 'anime' && custom.episodes !== undefined) {
      updatedVideo.episodes = custom.episodes;
    }
    if (updatedVideo.media_type === 'tv' && custom.seasons !== undefined) {
       updatedVideo.seasons = custom.seasons;
    }
    return updatedVideo;
  }, []);

  useEffect(() => {
    if (!tmdbId || !mediaType) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const typeToFetch = mediaType === 'anime' ? 'tv' : mediaType;
        const initialMedia: TMDBMedia = {
            id: Number(tmdbId),
            media_type: typeToFetch,
            name: '', title: '', overview: '', poster_path: '', backdrop_path: '',
            genre_ids: [], release_date: '', first_air_date: '', vote_average: 0,
        };

        let enrichedVideo = await tmdbMediaToVideo(initialMedia);
        if (!enrichedVideo) {
          setVideo(null);
          setIsLoading(false);
          return;
        }
        
        if (mediaType === 'anime') {
            enrichedVideo.media_type = 'anime';
        }

        const customData = getCustomVideoData();
        enrichedVideo = applyCustomData(enrichedVideo, customData);
        setVideo(enrichedVideo);

        // Fetch supplemental episode/season data
        const supplementalPromises = [];
        if (enrichedVideo.media_type === 'anime' && enrichedVideo.mal_id) {
            supplementalPromises.push(getAnimeEpisodes(String(enrichedVideo.mal_id)).then(setAnimeEpisodeDetails));
        }
        const isSeries = enrichedVideo.media_type === 'tv' || enrichedVideo.media_type === 'anime';
        const seasonsToFetch = enrichedVideo.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0) || [];
        if (isSeries && seasonsToFetch.length > 0) {
            const seasonDetailsPromises = seasonsToFetch.map(season =>
                getTvSeasonDetails(enrichedVideo!.id, season.season_number).then(details => (details?.episodes ? { [season.season_number]: details.episodes } : {}))
            );
            supplementalPromises.push(
                Promise.all(seasonDetailsPromises).then(results => {
                    const combinedDetails = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
                    setTvSeasonDetails(combinedDetails);
                })
            );
        }

        await Promise.all(supplementalPromises);

      } catch (error) {
        console.error('Failed to fetch video data', error);
        setVideo(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [tmdbId, mediaType, applyCustomData]);

  // Handle a directUrl passed from the Search Direct Links modal.
  // This must work regardless of the currently selected source so that
  // clicking "Open" on a resolved link always plays that link.
  useEffect(() => {
    if (directUrlParam && directUrlParam.startsWith('http')) {
      setSelectedStreamUrl(directUrlParam);
      setResolvedStreams([
        {
          url: directUrlParam,
          type: directUrlParam.includes('.m3u8') ? 'hls' : 'mp4',
          quality: 'auto',
          server: 'direct-link',
        } as ResolvedStream,
      ]);
      // Clean up URL to prevent re-triggering on re-renders
      const cleanUrl = `/watch?id=${tmdbId}&type=${mediaType}&s=${currentSeason}&e=${currentEpisode}`;
      window.history.replaceState(null, '', cleanUrl);
    }
    // We intentionally do NOT clear selectedStreamUrl when directUrlParam is
    // absent — the user may have selected a stream from the selector.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directUrlParam]);

  // ReelView Engine: auto-resolve streams when source is reelview-engine
  useEffect(() => {
    // If a directUrl was passed from Search Direct Links modal, skip auto-resolve
    if (directUrlParam && directUrlParam.startsWith('http')) return;

    if (source !== 'reelview-engine' || !tmdbId || !video) return;
    if (mediaType === 'movie') return; // Only for TV for now

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Clear any previous safety timeout
    if (resolveSafetyTimerRef.current) {
      clearTimeout(resolveSafetyTimerRef.current);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Safety timeout: auto-clear isResolving after 95 seconds.
    // Render.com free tier can take 50+ seconds to cold-start, plus up to
    // 18s for the resolution engine itself. 95s gives plenty of headroom.
    resolveSafetyTimerRef.current = setTimeout(() => {
      setIsResolving(false);
    }, 95000);

    const fetchStreams = async () => {
      setIsResolving(true);
      setResolvedStreams([]);
      setSelectedStreamUrl(null);
      try {
        const res = await fetch(apiUrl('/api/resolve-stream'), {
          signal: AbortSignal.timeout(90000), // 90s timeout (covers cold start)
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tmdbId,
            type: 'tv',
            season: currentSeason,
            episode: currentEpisode,
            title: video.title || video.name || '',
          }),
        });
        const data = await res.json();
        if (data.success && data.sources && data.sources.length > 0) {
          console.log(
            `[Watch] RESOLVE OK  tmdbId=${tmdbId}  S=${currentSeason}  E=${currentEpisode}  ` +
            `sources=${data.sources.length}  provider=${data.provider ?? '?'}  ` +
            `fromCache=${data.fromCache ?? false}  ` +
            `firstUrl=${data.sources[0].url?.slice(0, 80)}...`
          );

          const streams: ResolvedStream[] = data.sources.map((s: any) => ({
            // Prefix relative proxy URLs with API_BASE so they hit the backend
            // instead of the GitHub Pages domain.
            url: s.url?.startsWith('/') ? apiUrl(s.url) : s.url,
            type: s.type,
            quality: s.quality,
            server: s.server,
            // Original unproxied URL for external playback (open in new tab)
            rawUrl: s.rawUrl || undefined,
          }));

          // Extract subtitle tracks from response (if any)
          const subtitles: SubtitleTrack[] = (data.subtitles || data.data?.subtitles || []).map((s: any) => ({
            lang: s.lang || 'Unknown',
            url: s.url?.startsWith('/') ? apiUrl(s.url) : s.url,
            format: s.format || 'vtt',
            default: s.default || false,
          }));
          if (subtitles.length > 0) {
            console.log(`[Watch] Found ${subtitles.length} subtitle tracks`, subtitles.map(s => s.lang));
          }

          console.log(`[Watch] Setting ${streams.length} streams, first proxied=${streams[0]?.url?.slice(0, 80)}...`);

          setResolvedStreams(streams);
          setResolvedSubtitles(subtitles);
          setSelectedStreamUrl(streams[0].url);

          // ── Background Pre-Cache ──────────────────────────────────────
          // After resolving episode N, pre-resolve adjacent episodes so that
          // navigating to them feels instant (cache hit). Fire-and-forget.
          if (data.sources?.length > 0 && mediaType === 'tv') {
            const currentS = currentSeason;
            const currentE = currentEpisode;
            const episodesToPrecache: { season: number; episode: number }[] = [];

            // Previous episode (N-1)
            if (currentE > 1) {
              episodesToPrecache.push({ season: currentS, episode: currentE - 1 });
            } else {
              // cSeasonIdx already declared below; use a local lookup
              const pSeasonIdx = seasonsToDisplay.findIndex((s: any) => s.season_number === currentS);
              if (pSeasonIdx > 0) {
                const prevSeason = seasonsToDisplay[pSeasonIdx - 1];
                if (prevSeason) {
                  episodesToPrecache.push({ season: prevSeason.season_number, episode: prevSeason.episode_count });
                }
              }
            }

            // Next episodes (N+1, N+2)
            const cSeasonIdx = seasonsToDisplay.findIndex((s: any) => s.season_number === currentS);
            const currentSeasonData = seasonsToDisplay.find((s: any) => s.season_number === currentS);
            if (currentSeasonData) {
              if (currentE + 1 <= currentSeasonData.episode_count) {
                episodesToPrecache.push({ season: currentS, episode: currentE + 1 });
              } else if (cSeasonIdx >= 0 && cSeasonIdx + 1 < seasonsToDisplay.length) {
                const nextSeason = seasonsToDisplay[cSeasonIdx + 1];
                if (nextSeason) {
                  episodesToPrecache.push({ season: nextSeason.season_number, episode: 1 });
                }
              }

              if (currentE + 2 <= currentSeasonData.episode_count) {
                episodesToPrecache.push({ season: currentS, episode: currentE + 2 });
              } else if (currentE + 1 <= currentSeasonData.episode_count && cSeasonIdx >= 0) {
                const nextSeason = seasonsToDisplay[cSeasonIdx + 1];
                if (nextSeason) {
                  episodesToPrecache.push({ season: nextSeason.season_number, episode: 2 });
                }
              }
            }

            if (episodesToPrecache.length > 0) {
              fetch(apiUrl('/api/precache-stream'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tmdbId,
                  type: 'tv',
                  title: video.title || video.name || '',
                  episodes: episodesToPrecache,
                }),
              }).catch(() => {});
              console.log('[Watch] Pre-cache ' + episodesToPrecache.length + ' adjacent episodes', episodesToPrecache);
            }
          }
          // ── End Background Pre-Cache ─────────────────────────────────
        } else {
          console.warn(
            `[Watch] RESOLVE FAIL  tmdbId=${tmdbId}  S=${currentSeason}  E=${currentEpisode}  ` +
            `reason=${data.error ?? 'no sources returned'}`
          );
        }
      } catch (err) {
        console.error(`[Watch] RESOLVE ERROR  tmdbId=${tmdbId}  S=${currentSeason}  E=${currentEpisode}`, err);
      } finally {
        setIsResolving(false);
        if (resolveSafetyTimerRef.current) {
          clearTimeout(resolveSafetyTimerRef.current);
          resolveSafetyTimerRef.current = null;
        }
      }
    };
    fetchStreams();

    return () => {
      controller.abort();
      if (resolveSafetyTimerRef.current) {
        clearTimeout(resolveSafetyTimerRef.current);
        resolveSafetyTimerRef.current = null;
      }
    };
  }, [source, tmdbId, video, mediaType, currentSeason, currentEpisode, directUrlParam]);

  // When a ReelView Engine stream is selected, build the embed player URL
  useEffect(() => {
    if (source === 'reelview-engine' && selectedStreamUrl) {
      const selected = resolvedStreams.find((s) => s.url === selectedStreamUrl);
      const streamType = selected?.type || (selectedStreamUrl.includes('.m3u8') || selectedStreamUrl.includes('proxy-stream') ? 'hls' : 'mp4');
      setSelectedStreamType(streamType);
      setEmbedPlayerUrl(apiUrl(`/api/embed-player?url=${encodeURIComponent(selectedStreamUrl)}&type=${streamType}`));
    } else {
      setEmbedPlayerUrl('');
      setSelectedStreamType('');
    }
  }, [source, selectedStreamUrl, resolvedStreams]);

  const playerUrl = useMemo(() => {
    if (!video) return '';

    const s = currentSeason || 1;
    const e = currentEpisode || 1;
    
    const vidlinkUrl = video.media_type === 'movie'
      ? `https://vidlink.pro/movie/${video.id}?autoplay=true`
      : `https://vidlink.pro/tv/${video.id}/${s}/${e}?autoplay=true`;

    const xpassUrl = video.media_type === 'movie'
      ? `https://play.xpass.top/e/movie/${video.id}?autostart=true`
      : `https://play.xpass.top/e/tv/${video.id}/${s}/${e}?autostart=true`;

    let url = '';

    // If a direct stream URL was selected (via Search Direct Links modal or
    // the stream selector), always prefer it over any embed source.
    if (selectedStreamUrl) {
      url = selectedStreamUrl;
    } else {
      switch (source) {
        case 'vidlink':
          url = vidlinkUrl;
          break;
        case 'vidsrc':
          url = video.media_type === 'movie'
            ? `https://vidsrc.net/embed/movie?tmdb=${video.id}`
            : `https://vidsrc.net/embed/tv?tmdb=${video.id}&season=${s}&episode=${e}`;
          break;
        case 'godrive':
          if (video.media_type === 'movie') {
            url = `https://godriveplayer.com/player.php?type=movie&tmdb=${video.id}`;
          } else {
            url = `https://godriveplayer.com/player.php?type=series&tmdb=${video.id}&season=${s}&episode=${e}`;
          }
          break;
        case 'mostream':
          if (video.media_type === 'movie') {
            url = `https://mostream.us/embed.php?tmdb=${video.id}`;
          } else {
            url = `https://mostream.us/embed.php?tmdb=${video.id}&s=${s}&e=${e}`;
          }
          break;
        case 'reelview-engine':
          url = '';
          break;
        case 'default':
        default:
          url = xpassUrl;
          break;
      }
    }

    // When ReelView Engine is selected with no resolved URL, never silently
    // fallback to xpass — return empty so the player shows a placeholder.
    if (source === 'reelview-engine' && !url) {
      return '';
    }
    
    const finalUrl = url || xpassUrl;
    console.log(`[Player] Generated player URL for "${video.title}" (Source: ${source}): ${finalUrl}`);
    return finalUrl;
  }, [video, currentSeason, currentEpisode, source, selectedStreamUrl]);


  const seasonsToDisplay = useMemo(() => {
    if (!video) return [];
    const isAnime = video.media_type === 'anime';
    if (isAnime && video.episodes && (!video.seasons || video.seasons.length === 0)) {
        return [{ season_number: 1, episode_count: video.episodes, name: 'Episodes' }];
    }
    return video.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).sort((a, b) => a.season_number - b.season_number) || [];
  }, [video]);
  
  const handleEpisodeSelect = (season: number, episode: number) => {
    setCurrentSeason(season);
    setCurrentEpisode(episode);

    // update history immediately so continue-watching reflects this navigation
    updateWatchPositionOnNavigate(String(tmdbId || ''), mediaType as any, season, episode, video?.title || '');
    
    const newUrl = `/watch?id=${tmdbId}&type=${mediaType}&s=${season}&e=${episode}`;
    navigate(newUrl);
  };
  
  const handleNext = () => {
    if (!video || isLoading) return;
    
    const currentSeasonData = seasonsToDisplay.find(s => s.season_number === currentSeason);
    if (!currentSeasonData) return;

    if (currentEpisode < currentSeasonData.episode_count) {
      handleEpisodeSelect(currentSeason, currentEpisode + 1);
    } else {
        const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
        if (currentSeasonIndex < seasonsToDisplay.length - 1) {
            const nextSeason = seasonsToDisplay[currentSeasonIndex + 1];
            if(nextSeason) {
                handleEpisodeSelect(nextSeason.season_number, 1);
            }
        }
    }
  };

  const handlePrev = () => {
    if (!video || isLoading) return;
    if (currentEpisode > 1) {
      handleEpisodeSelect(currentSeason, currentEpisode - 1);
    } else {
      const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
       if (currentSeasonIndex > 0) {
          const prevSeason = seasonsToDisplay[currentSeasonIndex - 1];
          if(prevSeason) {
            handleEpisodeSelect(prevSeason.season_number, prevSeason.episode_count);
          }
      }
    }
  };

  const hasPrev = useMemo(() => {
      if (!seasonsToDisplay || seasonsToDisplay.length === 0) return false;
      const firstSeason = seasonsToDisplay[0];
      if (!firstSeason) return false;
      return currentSeason > firstSeason.season_number || currentEpisode > 1;
  }, [currentEpisode, currentSeason, seasonsToDisplay]);

  const hasNext = useMemo(() => {
    if (!seasonsToDisplay || seasonsToDisplay.length === 0) return false;
    const currentSeasonData = seasonsToDisplay.find(s => s.season_number === currentSeason);
    if (!currentSeasonData) return false;

    if (currentEpisode < currentSeasonData.episode_count) {
        return true;
    }
    
    const currentSeasonIndex = seasonsToDisplay.findIndex(s => s.season_number === currentSeason);
    return currentSeasonIndex < seasonsToDisplay.length - 1;
  }, [currentEpisode, currentSeason, seasonsToDisplay]);

  if (!tmdbId || !mediaType) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><div>Content not found</div></div>;
  }

  if (isLoading) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><Skeleton className="h-full w-full" /></div>;
  }
  
  if (!video) {
    return <div className="h-screen w-screen bg-black flex justify-center items-center"><div>Video not found</div></div>;
  }

  return (
    <div className="h-screen w-screen bg-black overflow-y-auto">
      <div className="relative h-full w-full flex flex-col">
        <WatchHeader 
            video={video}
            currentSeason={currentSeason}
            currentEpisode={currentEpisode}
            onNext={handleNext}
            onPrev={handlePrev}
            onOpenEpisodes={() => setIsSheetOpen(true)}
            hasNext={hasNext}
            hasPrev={hasPrev}
            playerUrl={playerUrl}
            resolvedStreams={resolvedStreams}
            selectedStreamUrl={selectedStreamUrl}
            onStreamSelect={setSelectedStreamUrl}
            isResolving={isResolving}
            showStreamSelector={source === 'reelview-engine'}
        />
        <div className="flex-1 relative w-full min-h-0">
          {selectedStreamUrl ? (
            source === 'reelview-engine' ? (
              /* ReelView Engine: use embed iframe instead of native <video>.
                 The embed player page handles HLS (via hls.js) or MP4 playback
                 and bypasses CORS since it's served from the Render backend. */
              <iframe
                src={embedPlayerUrl || playerUrl}
                className="h-full w-full bg-black"
                allow="autoplay; fullscreen"
                allowFullScreen
                title="Stream Player"
              />
            ) : (
              <DirectStreamPlayer
                video={video}
                streamUrl={playerUrl}
                streamType={
                  (resolvedStreams.find((s) => s.url === selectedStreamUrl)?.type ||
                  (playerUrl.includes('.m3u8') || playerUrl.includes('proxy-stream') ? 'hls' : 'mp4')) as 'hls' | 'mp4' | 'mkv'
                }
                season={currentSeason}
                episode={currentEpisode}
                subtitles={resolvedSubtitles}
                tmdbId={tmdbId || undefined}
                title={video.title || video.name || ''}
                imdbId={video.external_ids?.imdb_id || undefined}
              />
            )
          ) : (
            <VidlinkPlayer
              video={video}
              playerUrl={playerUrl}
              season={currentSeason}
              episode={currentEpisode}
            />
          )}
        </div>
        <div className="h-16 shrink-0" />
      </div>
      
      {mediaType !== 'movie' && (
        <EpisodeSelectionSheet
          video={video}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          currentSeason={currentSeason}
          currentEpisode={currentEpisode}
          onEpisodeSelect={handleEpisodeSelect}
          tvSeasonDetails={tvSeasonDetails}
          animeEpisodeDetails={animeEpisodeDetails}
        />
      )}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black flex justify-center items-center"><Skeleton className="h-full w-full" /></div>}>
      <WatchPageContent />
    </Suspense>
  )
}