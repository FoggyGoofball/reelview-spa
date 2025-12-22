/**
 * SIMPLIFIED Download API - works on Electron and Capacitor
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
const isElectron = typeof window !== 'undefined' && !!(window as any).electronDownload;

export function getDownloadAPI() {
  if (isElectron) {
    return getElectronAPI();
  }
  if (isCapacitor) {
    return getCapacitorAPI();
  }
  return getWebAPI();
}

function getElectronAPI() {
  const download = (window as any).electronDownload;
  
  return {
    getCapturedStreams: async () => {
      try {
        const streams = await download?.getStreams?.();
        return streams || [];
      } catch (e) {
        console.error('Electron getCapturedStreams error:', e);
        return [];
      }
    },

    startDownload: async (url: string, filename: string, quality?: string) => {
      try {
        const result = await download?.downloadStream?.({
          url,
          filename: `${filename}.mkv`,
          quality
        });
        return result || { success: false, error: 'Download API not available' };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },

    getQualityVariants: async (url: string) => {
      try {
        const variants = await download?.getQualities?.({ url });
        return variants || [{ url, bandwidth: 0, label: 'Default Quality' }];
      } catch (e) {
        return [{ url, bandwidth: 0, label: 'Default Quality' }];
      }
    },

    cancelDownload: async () => {
      try {
        await download?.cancelDownload?.();
        return { success: true };
      } catch (e) {
        return { success: false };
      }
    },
    
    getDownloadsList: async () => [],
    removeDownload: async () => ({ success: false }),
    clearCompletedDownloads: async () => ({ success: false }),

    onStreamCaptured: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloadsUpdated: () => () => {}
  };
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
  return isElectron || isCapacitor;
}

export function getPlatform(): 'electron' | 'capacitor' | 'web' {
  if (isElectron) return 'electron';
  if (isCapacitor) return 'capacitor';
  return 'web';
}
