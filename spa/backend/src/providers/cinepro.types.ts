/**
 * CinePro-style multi-server scraper types.
 * Adapted from the cinepro-org/core codebase for VidNest, Tulnex, Peachify,
 * VidZee, Videasy, Popr, CineSu, Icefy, VidApi, VidRock, and StreamMafia.
 */

export interface StreamSource {
  url: string;
  type: 'hls' | 'mp4' | 'mkv';
  quality?: string;
  headers?: Record<string, string>;
  server?: string;
}

export interface ScrapeResult {
  server: string;
  sources: StreamSource[];
  error?: string;
}

// ─── VidNest ─────────────────────────────────────────────────────────────────

export interface VidNestEncryptedResponse {
  encrypted: boolean;
  data: string;
}

export interface MovieboxUrlEntry {
  lang: string;
  link: string;
  resolution: string;
  type: string;
}

export interface MovieboxResponse {
  headers?: Record<string, string>;
  url: MovieboxUrlEntry[];
}

export interface AllMoviesStream {
  headers?: Record<string, string>;
  language: string;
  type: string;
  url: string;
}

export interface AllMoviesResponse {
  streams: AllMoviesStream[];
  totalLanguages: number;
}

export interface KlikxxiSource {
  quality: string;
  type: string;
  url: string;
}

export interface KlikxxiResponse {
  sources: KlikxxiSource[];
  title?: string;
  year?: string;
}

export interface OneHDResponse {
  headers?: Record<string, string>;
  subtitles?: { lang: string; url: string }[];
  url: string;
}

export interface HollyMovieHDSource {
  file: string;
  label: string;
  type: string;
}

export interface HollyMovieHDResponse {
  sources: HollyMovieHDSource[];
  success: boolean;
}

export interface PurstreamSource {
  format: string;
  name: string;
  url: string;
}

export interface PurstreamResponse {
  sources: PurstreamSource[];
  title?: string;
  purstream_id?: number;
}

// ─── Tulnex ──────────────────────────────────────────────────────────────────

export interface TulnexApiResponse {
  v: string;
  payload: string;
}

export interface TulnexExtractedStream {
  url: string;
  headers: Record<string, string> | null;
}

// ─── VidZee ──────────────────────────────────────────────────────────────────

export interface VidZeeStreamUrl {
  lang: string;
  link: string;
  type: string;
  message: string;
  name: string;
  flag: string;
}

export interface VidZeeStreamResponse {
  headers: Record<string, string>;
  provider: string;
  url: VidZeeStreamUrl[];
  tracks: { lang: string; url: string }[];
  serverInfo: { number: number; name: string; flag: string; language: string };
}

// ─── Peachify ────────────────────────────────────────────────────────────────

export interface PeachifyRawSource {
  url?: string;
  src?: string;
  file?: string;
  stream?: string;
  streamUrl?: string;
  playbackUrl?: string;
  type?: string;
  format?: string;
  container?: string;
  dub?: string;
  audio?: string;
  audioName?: string;
  audioLang?: string;
  language?: string;
  lang?: string;
  label?: string;
  name?: string;
  title?: string;
  quality?: string | number;
  resolution?: string | number;
  height?: string | number;
  res?: string | number;
  sizeBytes?: number;
  size?: number;
  bytes?: number;
  headers?: Record<string, string>;
  header?: Record<string, string>;
  requestHeaders?: Record<string, string>;
  httpHeaders?: Record<string, string>;
}

export interface PeachifyRawSubtitle {
  url?: string;
  file?: string;
  src?: string;
  label?: string;
  name?: string;
  language?: string;
  langCode?: string;
  lang?: string;
}

export interface PeachifyApiResponse {
  isEncrypted?: boolean;
  data?: string;
  sources?: PeachifyRawSource[];
  subtitles?: PeachifyRawSubtitle[];
}

// ─── Videasy ─────────────────────────────────────────────────────────────────

export interface VideasyRawSource {
  url: string;
  quality?: string;
  type?: string;
}

export interface VideasyRawSubtitle {
  url: string;
  label?: string;
  language?: string;
  lang?: string;
}

export interface VideasyDecryptedPayload {
  sources: VideasyRawSource[];
  subtitles?: VideasyRawSubtitle[];
}

// ─── Popr ────────────────────────────────────────────────────────────────────

export interface PoprStream {
  url: string;
  quality: string;
  isM3U8: boolean;
  headers?: {
    Referer?: string;
    Origin?: string;
  };
}

export interface PoprResult {
  server: string;
  serverName: string;
  streams: PoprStream[];
  subtitles?: {
    url: string;
    format: string;
    lang: string;
  }[];
}

export interface PoprResponse {
  success: boolean;
  results: PoprResult[];
}

// ─── CineSu / Icefy / VidApi (simple direct APIs) ────────────────────────────

export interface CineSuResponse {
  stream: string;
}

export interface IcefyResponse {
  stream: string;
}

export interface VidApiData {
  title: string;
  imdb_id: string;
  season: string;
  episode: string;
  file_name: string;
  backdrop: string;
  stream_urls: string[];
}

export interface VidApiResponse {
  status_code: string;
  data: VidApiData;
  default_subs?: {
    lang: string;
    code: string;
    url: string;
  }[];
}

// ─── VidRock ─────────────────────────────────────────────────────────────────

export interface VidrockStreamInfo {
  url: string | null;
  language: string | null;
  flag: string | null;
}

export type VidrockStreams = Record<string, VidrockStreamInfo>;

export interface VidrockCDN {
  resolution: string;
  url: string;
}

// ─── StreamMafia ─────────────────────────────────────────────────────────────

export interface StreamMafiaEncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

export interface StreamMafiaDownload {
  quality: string;
  url: string;
}

export interface StreamMafiaStream {
  status: string;
  title: string;
  hls_streaming: string;
  duration: string;
  download: StreamMafiaDownload[];
}

export interface StreamMafiaSelected {
  file_code: string;
  lang_code: string;
  lang: string;
  title: string;
  source_title: string;
}

export interface StreamMafiaSwitch {
  id: number;
  title: string;
  file_code: string;
  lang_code: string;
  lang: string;
  embed_url: string;
}

export interface StreamMafiaApiResponse {
  status: string;
  selected: StreamMafiaSelected;
  switches: StreamMafiaSwitch[];
  stream: StreamMafiaStream;
}

// ─── Resolve Stream API ──────────────────────────────────────────────────────

export interface SubtitleTrack {
  lang: string;
  url: string;
  format: 'vtt' | 'srt' | 'ass';
  default?: boolean;
}

export interface ResolveStreamRequest {
  tmdbId: string;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
}

export interface ResolveStreamResponse {
  success: boolean;
  sources?: StreamSource[];
  subtitles?: SubtitleTrack[];
  error?: string;
  fromCache?: boolean;
  provider?: string;
}
