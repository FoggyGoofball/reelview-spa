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
        const streams = await download?.getCapturedStreams?.();
        return streams || [];
      } catch (e) {
        console.error('Electron getCapturedStreams error:', e);
        return [];
      }
    },

    startDownload: async (url: string, filename: string, quality?: string) => {
      try {
        const result = await download?.startDownload?.(url, filename, quality);
        return result || { success: false, error: 'Download API not available' };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },

    getQualityVariants: async (url: string) => {
      try {
        const variants = await download?.getQualityVariants?.(url);
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
    
    getDownloadsList: async () => {
      try {
        const res = await download?.getDownloadsList?.();
        // preload returns { downloads: [...] } or an array depending on implementation - normalize
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (res.downloads) return res.downloads;
        return [];
      } catch (e) {
        console.error('getDownloadsList error', e);
        return [];
      }
    },

    removeDownload: async (id: string, deleteFile: boolean = false) => {
      try {
        const res = await download?.removeDownload?.(id, deleteFile);
        return res || { success: false };
      } catch (e) {
        return { success: false };
      }
    },

    clearCompletedDownloads: async () => {
      try {
        const res = await download?.clearCompletedDownloads?.();
        return res || { success: false };
      } catch (e) {
        return { success: false };
      }
    },

    onStreamCaptured: (cb: (stream: any) => void) => {
      if (!download?.onStreamCaptured) return () => {};
      return download.onStreamCaptured(cb);
    },

    // Full captured streams list event
    onCapturedStreamsList: (cb: (streams: any[]) => void) => {
      if (!download?.onCapturedStreamsList) return () => {};
      return download.onCapturedStreamsList(cb);
    },

    onDownloadProgress: (cb: (progress: any) => void) => {
      if (!download?.onDownloadProgress) return () => {};
      return download.onDownloadProgress(cb);
    },

    onDownloadsUpdated: (cb: (downloads: any[]) => void) => {
      if (!download?.onDownloadsUpdated) return () => {};
      return download.onDownloadsUpdated(cb);
    },

    requestCapturedStreamsPush: async () => {
      try {
        const res = await download?.requestCapturedStreamsPush?.();
        return res || { success: false };
      } catch (e) {
        return { success: false };
      }
    },
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

export async function getBuildInfo() {
  // Try electron preload first
  try {
    const e = (window as any).electronDownload;
    if (e && e.getBuildInfo) {
      const info = await e.getBuildInfo();
      return info;
    }
  } catch (e) {}

  // fallback to empty info
  return { buildTime: new Date().toISOString() };
}
