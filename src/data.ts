// Minimal production data types used by server-side code
export type Video = {
  id: string;
  title: string;
  description?: string;
  media_type: 'movie' | 'tv' | 'anime';
  mal_id?: number;
  episodes?: number;
  seasons?: { season_number: number; episode_count: number; name?: string }[];
  [key: string]: any;
};

export type WatchProgress = {
  id: string;
  type: 'movie' | 'tv' | 'anime';
  title: string;
  poster_path?: string;
  progress?: { watched: number; duration: number };
  [key: string]: any;
};

export const videos: Video[] = [];
export const categories: { id: string; name: string }[] = [];