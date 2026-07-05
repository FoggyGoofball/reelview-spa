import type { WatchProgress } from '@/lib/data';

interface GitHubContentResponse {
  sha: string;
  content: string;
}

interface SyncConfig {
  owner: string;
  repo: string;
  branch: string;
  pathPrefix: string;
  token: string;
}

export interface MergeResult {
  merged: Record<string, WatchProgress>;
  mergedCount: number;
}

export interface UploadResult {
  merged: Record<string, WatchProgress>;
  mergedCount: number;
  remoteCountBeforeMerge: number;
}

const SYNC_VERSION = 1;
const SYNC_TOKEN_KEY = 'reelview_sync_token';

export function getSyncToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(SYNC_TOKEN_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setSyncToken(token: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = token.trim();
  if (!trimmed) return;
  localStorage.setItem(SYNC_TOKEN_KEY, trimmed);
}

export function clearSyncToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SYNC_TOKEN_KEY);
}

function getSyncConfig(): SyncConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const runtimeToken = getSyncToken();

  return {
    owner: env.VITE_SYNC_GITHUB_OWNER || 'FoggyGoofball',
    repo: env.VITE_SYNC_GITHUB_REPO || 'reelview-sync-data',
    branch: env.VITE_SYNC_GITHUB_BRANCH || 'main',
    pathPrefix: env.VITE_SYNC_GITHUB_PATH_PREFIX || 'history-sync',
    token: runtimeToken || env.VITE_SYNC_GITHUB_TOKEN || '',
  };
}

function ensureConfigForRead(config: SyncConfig) {
  if (!config.owner || !config.repo) {
    throw new Error('Sync is not configured. Missing GitHub owner/repo.');
  }
}

function ensureConfigForWrite(config: SyncConfig) {
  ensureConfigForRead(config);
  if (!config.token) {
    throw new Error('Upload requires a sync token. Click Set Sync Token first.');
  }
}

function sanitizeIdentifier(identifier: string): string {
  const clean = identifier.trim();
  if (!clean) {
    throw new Error('Identifier is required.');
  }

  if (!/^[a-zA-Z0-9._-]{1,64}$/.test(clean)) {
    throw new Error('Identifier can only contain letters, numbers, dot, underscore, and dash (max 64 chars).');
  }

  return clean;
}

function normalizeTitle(title?: string): string {
  return (title || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function episodeRank(item: WatchProgress): [number, number] {
  const season = Number(item.last_season_watched || 0);
  const episode = Number(item.last_episode_watched || 0);
  return [Number.isFinite(season) ? season : 0, Number.isFinite(episode) ? episode : 0];
}

function progressScore(item: WatchProgress): number {
  const watched = Number(item.progress?.watched || 0);
  const duration = Number(item.progress?.duration || 0);
  if (duration <= 0) return watched;
  return watched / duration;
}

function toStorageKey(item: WatchProgress): string {
  if (item.type === 'anime' && item.mal_id) {
    return `mal-${item.mal_id}`;
  }
  return `tmdb-${item.id}`;
}

function mergeItem(a: WatchProgress, b: WatchProgress): WatchProgress {
  const newer = (a.last_updated || 0) >= (b.last_updated || 0) ? a : b;
  const older = newer === a ? b : a;

  const [aSeason, aEpisode] = episodeRank(a);
  const [bSeason, bEpisode] = episodeRank(b);

  let bestSeason = aSeason;
  let bestEpisode = aEpisode;

  if (bSeason > aSeason || (bSeason === aSeason && bEpisode > aEpisode)) {
    bestSeason = bSeason;
    bestEpisode = bEpisode;
  }

  const bestProgress = progressScore(a) >= progressScore(b) ? a.progress : b.progress;

  return {
    ...older,
    ...newer,
    id: newer.id || older.id,
    title: newer.title || older.title,
    type: newer.type || older.type,
    poster_path: newer.poster_path || older.poster_path,
    progress: bestProgress,
    last_season_watched: bestSeason > 0 ? String(bestSeason) : newer.last_season_watched || older.last_season_watched,
    last_episode_watched: bestEpisode > 0 ? String(bestEpisode) : newer.last_episode_watched || older.last_episode_watched,
    last_updated: Math.max(a.last_updated || 0, b.last_updated || 0),
    show_progress: {
      ...(older.show_progress || {}),
      ...(newer.show_progress || {}),
    },
  };
}

export function mergeWatchHistories(
  localHistory: Record<string, WatchProgress>,
  remoteHistory: Record<string, WatchProgress>
): MergeResult {
  const deduped = new Map<string, WatchProgress>();

  const allItems = [...Object.values(localHistory || {}), ...Object.values(remoteHistory || {})].filter(Boolean);

  for (const item of allItems) {
    if (!item?.type) continue;

    const titleKey = normalizeTitle(item.title);
    const fallbackId = item.type === 'anime' && item.mal_id ? `mal-${item.mal_id}` : `id-${item.id || ''}`;
    const dedupeKey = `${item.type}:${titleKey || fallbackId}`;

    const existing = deduped.get(dedupeKey);
    if (!existing) {
      deduped.set(dedupeKey, item);
      continue;
    }

    deduped.set(dedupeKey, mergeItem(existing, item));
  }

  const merged: Record<string, WatchProgress> = {};

  for (const item of deduped.values()) {
    const key = toStorageKey(item);
    merged[key] = item;
  }

  return {
    merged,
    mergedCount: Object.keys(merged).length,
  };
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): string {
  const binary = atob(value.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function getContentPath(pathPrefix: string, identifier: string): string {
  return `${pathPrefix}/${identifier}.json`;
}

function createGitHubHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function getRemoteFile(
  config: SyncConfig,
  identifier: string
): Promise<{ sha: string; history: Record<string, WatchProgress> } | null> {
  const path = getContentPath(config.pathPrefix, identifier);
  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`,
    {
      method: 'GET',
      headers: createGitHubHeaders(config.token),
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch remote history (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as GitHubContentResponse;
  const decoded = fromBase64(payload.content || '');
  const parsed = JSON.parse(decoded) as { history?: Record<string, WatchProgress> };

  return {
    sha: payload.sha,
    history: parsed?.history || {},
  };
}

async function putRemoteFile(
  config: SyncConfig,
  identifier: string,
  history: Record<string, WatchProgress>,
  sha?: string
): Promise<void> {
  const path = getContentPath(config.pathPrefix, identifier);
  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  const body = {
    message: `sync history: ${identifier} @ ${new Date().toISOString()}`,
    content: toBase64(
      JSON.stringify(
        {
          version: SYNC_VERSION,
          updated_at: Date.now(),
          history,
        },
        null,
        2
      )
    ),
    branch: config.branch,
    ...(sha ? { sha } : {}),
  };

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`,
    {
      method: 'PUT',
      headers: createGitHubHeaders(config.token),
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload history (${response.status}): ${text}`);
  }
}

export async function downloadRemoteHistory(identifierInput: string): Promise<Record<string, WatchProgress>> {
  const config = getSyncConfig();
  ensureConfigForRead(config);

  const identifier = sanitizeIdentifier(identifierInput);
  const remote = await getRemoteFile(config, identifier);

  return remote?.history || {};
}

export async function uploadMergedHistory(
  identifierInput: string,
  localHistory: Record<string, WatchProgress>
): Promise<UploadResult> {
  const config = getSyncConfig();
  ensureConfigForWrite(config);

  const identifier = sanitizeIdentifier(identifierInput);
  const remote = await getRemoteFile(config, identifier);
  const remoteHistory = remote?.history || {};
  const mergedResult = mergeWatchHistories(localHistory, remoteHistory);

  await putRemoteFile(config, identifier, mergedResult.merged, remote?.sha);

  return {
    ...mergedResult,
    remoteCountBeforeMerge: Object.keys(remoteHistory).length,
  };
}
