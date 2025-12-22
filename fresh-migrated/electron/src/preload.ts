// =====================================================
// PRELOAD SCRIPT
// =====================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

const logFile = path.join(os.homedir(), 'reelview-preload.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch (e) {}
}

try {
  fs.writeFileSync(logFile, `=== PRELOAD ${new Date().toISOString()} ===\n`);
  log('Preload loaded');
} catch (e: any) {}

let ipcRenderer: any;
try {
  const electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  log('ipcRenderer loaded');
} catch (e: any) {
  log(`ERROR: ${e.message}`);
}

try {
  require('./rt/electron-rt');
  log('Capacitor loaded');
} catch (e: any) {
  log(`Capacitor error: ${e.message}`);
}

// =====================================================
// DOWNLOAD API
// =====================================================

const downloadAPI = {
  // Get captured m3u8 streams
  getCapturedStreams: async () => {
    try {
      return await ipcRenderer.invoke('get-captured-streams');
    } catch (e: any) {
      console.error('[DOWNLOAD] getCapturedStreams error:', e.message);
      return [];
    }
  },
  
  // Get quality variants for a stream
  getQualityVariants: async (url: string) => {
    try {
      return await ipcRenderer.invoke('get-quality-variants', { url });
    } catch (e: any) {
      console.error('[DOWNLOAD] getQualityVariants error:', e.message);
      return [];
    }
  },
  
  // Start download with specific quality
  startDownload: async (url: string, filename: string, quality?: string) => {
    try {
      return await ipcRenderer.invoke('start-download', { url, filename, quality });
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
  
  cancelDownload: async () => {
    try {
      return await ipcRenderer.invoke('cancel-download');
    } catch (e: any) {
      return { success: false };
    }
  },
  
  // Downloads list management
  getDownloadsList: async () => {
    try {
      return await ipcRenderer.invoke('get-downloads-list');
    } catch (e: any) {
      return [];
    }
  },
  
  removeDownload: async (id: string, deleteFile: boolean = false) => {
    try {
      return await ipcRenderer.invoke('remove-download', { id, deleteFile });
    } catch (e: any) {
      return { success: false };
    }
  },
  
  clearCompletedDownloads: async () => {
    try {
      return await ipcRenderer.invoke('clear-completed-downloads');
    } catch (e: any) {
      return { success: false };
    }
  },
  
  clearCapturedUrls: async () => {
    try {
      return await ipcRenderer.invoke('clear-captured-urls');
    } catch (e: any) {
      return { success: false };
    }
  },
  
  // Event listeners
  onStreamCaptured: (callback: (stream: any) => void) => {
    const handler = (_event: any, stream: any) => callback(stream);
    ipcRenderer.on('stream-captured', handler);
    return () => ipcRenderer.removeListener('stream-captured', handler);
  },
  
  onDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  
  onDownloadsUpdated: (callback: (downloads: any[]) => void) => {
    const handler = (_event: any, downloads: any[]) => callback(downloads);
    ipcRenderer.on('downloads-updated', handler);
    return () => ipcRenderer.removeListener('downloads-updated', handler);
  }
};

try {
  (window as any).electronDownload = downloadAPI;
  log('API attached');
} catch (e: any) {
  log(`Attach error: ${e.message}`);
}

log('Preload complete');

// Console forwarding
setTimeout(() => {
  const originalLog = console.log;
  console.log = function(...args: any[]) {
    originalLog.apply(console, args);
    try {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      ipcRenderer?.send('console-log', { level: 'log', message: msg });
    } catch {}
  };
}, 100);
