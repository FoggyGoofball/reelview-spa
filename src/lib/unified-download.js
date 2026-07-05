/**
 * SIMPLIFIED Download API - maximum clarity
 */
// Platform detection
const isCapacitor = typeof window !== 'undefined' && window.Capacitor !== undefined;
export function getDownloadAPI() {
    if (isCapacitor) {
        return getCapacitorAPI();
    }
    return getWebAPI();
}
function getCapacitorAPI() {
    const Cap = window.Capacitor;
    return {
        getCapturedStreams: async () => {
            try {
                const result = await Cap.Plugins.HLSDownloader.getCapturedStreams();
                return result.streams || [];
            }
            catch (e) {
                console.error('getCapturedStreams error:', e);
                return [];
            }
        },
        startDownload: async (url, filename, quality) => {
            try {
                return await Cap.Plugins.HLSDownloader.startDownload({ url, filename, quality });
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        },
        getQualityVariants: async (url) => {
            try {
                const result = await Cap.Plugins.HLSDownloader.getQualityVariants({ url });
                return result.variants || [];
            }
            catch (e) {
                return [{ url, bandwidth: 0, label: 'Default' }];
            }
        },
        cancelDownload: async () => ({ success: false }),
        getDownloadsList: async () => [],
        removeDownload: async () => ({ success: false }),
        clearCompletedDownloads: async () => ({ success: false }),
        onStreamCaptured: () => () => { },
        onCapturedStreamsList: () => () => { },
        onDownloadProgress: () => () => { },
        onDownloadsUpdated: () => () => { },
        requestCapturedStreamsPush: async () => ({ success: false })
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
        onStreamCaptured: () => () => { },
        onCapturedStreamsList: () => () => { },
        onDownloadProgress: () => () => { },
        onDownloadsUpdated: () => () => { },
        requestCapturedStreamsPush: async () => ({ success: false })
    };
}
export function isDownloadAvailable() {
    return isCapacitor;
}
export function getPlatform() {
    return isCapacitor ? 'capacitor' : 'web';
}
export async function getBuildInfo() {
    try {
        if (typeof window !== 'undefined' && window.electronDownload && typeof window.electronDownload.getBuildInfo === 'function') {
            return await window.electronDownload.getBuildInfo();
        }
    }
    catch (e) {
        // ignore
    }
    return { buildTime: new Date().toISOString() };
}
