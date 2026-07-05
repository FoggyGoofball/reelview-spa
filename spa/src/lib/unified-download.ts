// SPA wrapper for the unified download API exposed by the Electron/Capacitor preload
// Provides safe fallbacks for web builds.

interface DownloadAPI {
  getCapturedStreams?: () => Promise<any[]>;
  startDownload?: (url: string, filename: string, quality?: string) => Promise<any>;
  getQualityVariants?: (url: string) => Promise<any[]>;
  cancelDownload?: () => Promise<any>;
  getDownloadsList?: () => Promise<any[]>;
  removeDownload?: (id: string, deleteFile?: boolean) => Promise<any>;
  clearCompletedDownloads?: () => Promise<any>;
  onStreamCaptured?: (cb: (stream: any) => void) => () => void;
  onCapturedStreamsList?: (cb: (streams: any[]) => void) => () => void;
  onDownloadProgress?: (cb: (progress: any) => void) => () => void;
  onDownloadsUpdated?: (cb: (downloads: any[]) => void) => () => void;
  requestCapturedStreamsPush?: () => Promise<any>;
  getBuildInfo?: () => Promise<any>;
  openFile?: (path: string) => Promise<any>;
}

function getElectronApi(): DownloadAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as any).electronDownload || null;
}

function isCapacitorPresent(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor;
}

/**
 * Create a wrapped Capacitor API that normalizes the response format
 * Capacitor plugins return { downloads: [...] } but we need just [...]
 */
function createCapacitorWrapper(rawApi: any): DownloadAPI {
  return {
    getCapturedStreams: async () => {
      try {
        const result = await rawApi.getCapturedStreams();
        console.log('[DOWNLOAD] getCapturedStreams raw result:', result);
        // Capacitor returns { streams: [...] }
        return result?.streams || result || [];
      } catch (e) {
        console.error('[DOWNLOAD] getCapturedStreams error:', e);
        return [];
      }
    },
    startDownload: async (url: string, filename: string, quality?: string) => {
      try {
        const result = await rawApi.startDownload({ url, filename, quality });
        console.log('[DOWNLOAD] startDownload result:', result);
        return result || { success: false };
      } catch (e) {
        console.error('[DOWNLOAD] startDownload error:', e);
        return { success: false, error: String(e) };
      }
    },
    getQualityVariants: async (url: string) => {
      try {
        const result = await rawApi.getQualityVariants({ url });
        return result?.variants || result || [];
      } catch (e) {
        console.error('[DOWNLOAD] getQualityVariants error:', e);
        return [];
      }
    },
    cancelDownload: async () => {
      try {
        return await rawApi.cancelDownload?.() || { success: false };
      } catch (e) {
        return { success: false };
      }
    },
    getDownloadsList: async () => {
      try {
        const result = await rawApi.getDownloadsList();
        console.log('[DOWNLOAD] getDownloadsList raw result:', result);
        // Capacitor returns { downloads: [...] }
        return result?.downloads || result || [];
      } catch (e) {
        console.error('[DOWNLOAD] getDownloadsList error:', e);
        return [];
      }
    },
    removeDownload: async (id: string, deleteFile?: boolean) => {
      try {
        return await rawApi.removeDownload({ id, deleteFile: deleteFile || false });
      } catch (e) {
        return { success: false };
      }
    },
    clearCompletedDownloads: async () => {
      try {
        return await rawApi.clearCompletedDownloads();
      } catch (e) {
        return { success: false };
      }
    },
    onStreamCaptured: (cb: (stream: any) => void) => {
      try {
        // Capacitor uses addListener
        const handle = rawApi.addListener?.('stream-captured', (data: any) => {
          cb(data);
        });
        return () => { handle?.remove?.(); };
      } catch (e) {
        return () => {};
      }
    },
    onCapturedStreamsList: (cb: (streams: any[]) => void) => {
      return () => {};
    },
    onDownloadProgress: (cb: (progress: any) => void) => {
      try {
        const handle = rawApi.addListener?.('download-progress', (data: any) => {
          cb(data);
        });
        return () => { handle?.remove?.(); };
      } catch (e) {
        return () => {};
      }
    },
    onDownloadsUpdated: (cb: (downloads: any[]) => void) => {
      try {
        const handle = rawApi.addListener?.('downloads-updated', (data: any) => {
          // Extract downloads array from event data
          const downloads = data?.downloads || data || [];
          cb(downloads);
        });
        return () => { handle?.remove?.(); };
      } catch (e) {
        return () => {};
      }
    },
    requestCapturedStreamsPush: async () => {
      return { success: false };
    },
    getBuildInfo: async () => {
      return { buildTime: new Date().toISOString(), platform: 'capacitor' };
    },
    openFile: async (path: string) => {
      // Android doesn't support opening files directly
      return { success: false };
    },
  };
}

export function getDownloadAPI(): DownloadAPI {
  const electronApi = getElectronApi();
  if (electronApi) return electronApi;
  if (isCapacitorPresent()) {
    const rawCapacitorApi = (window as any).Capacitor?.Plugins?.HLSDownloader;
    if (rawCapacitorApi) {
      console.log('[DOWNLOAD] Using Capacitor HLSDownloaderPlugin (wrapped)');
      return createCapacitorWrapper(rawCapacitorApi);
    }
    console.warn('[DOWNLOAD] Capacitor present but HLSDownloader plugin not available');
  }

  const fallback: DownloadAPI = {
    getCapturedStreams: async () => [],
    startDownload: async () => ({ success: false, error: 'Not available' }),
    getQualityVariants: async () => [],
    cancelDownload: async () => ({ success: false }),
    getDownloadsList: async () => [],
    removeDownload: async () => ({ success: false }),
    clearCompletedDownloads: async () => ({ success: false }),
    onStreamCaptured: () => () => {},
    onCapturedStreamsList: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadsUpdated: () => () => {},
    requestCapturedStreamsPush: async () => ({ success: false }),
    getBuildInfo: async () => ({ buildTime: new Date().toISOString() }),
    openFile: async () => ({ success: false }),
  };
  
  return fallback;
}

export function isDownloadAvailable(): boolean {
  const available = !!getElectronApi() || isCapacitorPresent();
  if (!available && typeof window !== 'undefined') {
    const api = (window as any).Capacitor?.Plugins?.HLSDownloader;
    if (api) return true;
  }
  return available;
}

export function getPlatform(): 'electron' | 'capacitor' | 'web' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';
  if ((window as any).electronDownload) return 'electron';
  if ((window as any).Capacitor) return 'capacitor';
  return 'web';
}

export async function getBuildInfo(): Promise<any> {
  try {
    const api = getDownloadAPI();
    if (api && typeof api.getBuildInfo === 'function') return await api.getBuildInfo();
    return { buildTime: new Date().toISOString() };
  } catch (e) {
    return { buildTime: new Date().toISOString() };
  }
}

export default getDownloadAPI();
