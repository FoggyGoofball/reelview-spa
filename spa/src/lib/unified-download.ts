/**
 * SIMPLIFIED Download API - maximum clarity
 */

export interface QualityVariant {
  url: string;
  bandwidth: number;
  resolution?: string;
  label: string;
}

export interface DownloadProgress {
  status: 'fetching' | 'parsing' | 'downloading' | 'merging' | 'converting' | 'complete' | 'error' | 'cancelled';
  progress: number;
  currentSegment?: number;
  totalSegments?: number;
  downloadedBytes?: number;
  error?: string;
  filePath?: string;
}

// Platform detection
const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;

export function getDownloadAPI() {
  if (isCapacitor) {
    return getCapacitorAPI();
  }
  return getWebAPI();
}

function getCapacitorAPI() {
  const Cap = (window as any).Capacitor;
  
  return {
    getCapturedStreams: async () => {
      try {
        const result = await Cap.Plugins.HLSDownloader.getCapturedStreams();
        return result.streams || [];
      } catch (e) {
        console.error('getCapturedStreams error:', e);
        return [];
      }
    },

    startDownload: async (url: string, filename: string, quality?: string) => {
      try {
        return await Cap.Plugins.HLSDownloader.startDownload({ url, filename, quality });
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },

    getQualityVariants: async (url: string) => {
      try {
        const result = await Cap.Plugins.HLSDownloader.getQualityVariants({ url });
        return result.variants || [];
      } catch (e) {
        return [{ url, bandwidth: 0, label: 'Default' }];
      }
    },

    cancelDownload: async () => ({ success: false }),
    getDownloadsList: async () => [],
    removeDownload: async () => ({ success: false }),
    clearCompletedDownloads: async () => ({ success: false }),

    onStreamCaptured: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadsUpdated: () => () => {}
  };
}

function getWebAPI() {
  return {
    getCapturedStreams: async () => [],
    startDownload: async () => ({ success: false, error: 'Not available' }),
    getQualityVariants: async () => [],
    cancelDownload: async () => ({ success: false }),
    getDownloadsList: async () => [],
    removeDownload: async () => ({ success: false }),
    clearCompletedDownloads: async () => ({ success: false }),
    onStreamCaptured: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadsUpdated: () => () => {}
  };
}

export function isDownloadAvailable(): boolean {
  return isCapacitor;
}

export function getPlatform(): 'capacitor' | 'web' {
  return isCapacitor ? 'capacitor' : 'web';
}
