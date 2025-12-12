import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import { getCapacitorElectronConfig, setupElectronDeepLinking } from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, MenuItem, ipcMain, dialog, BrowserWindow } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import * as path from 'path';
import * as fs from 'fs';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';
import { 
  downloadStream, 
  cancelDownload, 
  getCapturedStreams,
  clearCapturedStreams,
  setupNetworkInterception,
  getQualityVariants,
  getDownloadsList,
  addDownload,
  updateDownload,
  removeDownload,
  clearCompletedDownloads,
  type DownloadItem
} from './hls-downloader';

unhandled();

// =====================================================
// FILE LOGGING
// =====================================================
const logFile = path.join(require('os').homedir(), 'reelview-main.log');

function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch (e) {}
  console.log(message);
}

try {
  fs.writeFileSync(logFile, `=== MAIN PROCESS STARTED ${new Date().toISOString()} ===\n`);
} catch (e) {}

logToFile('Main process starting...');

console.log('='.repeat(80));
console.log('MAIN PROCESS STARTING');
console.log('='.repeat(80));

// --- IPC LOGGING ---
ipcMain.on('console-log', (event, { level, message }) => {
  logToFile(`[RENDERER-${level}] ${message}`);
});

console.log('[MAIN] IPC Logging listener ENABLED');

// --- DOWNLOAD IPC HANDLERS ---

ipcMain.handle('get-captured-streams', async (event) => {
  const windowId = String(BrowserWindow.fromWebContents(event.sender)?.id || 'default');
  return getCapturedStreams(windowId);
});

ipcMain.handle('get-quality-variants', async (event, { url }) => {
  logToFile(`IPC: get-quality-variants - ${url.substring(0, 80)}`);
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return [];
  
  try {
    const variants = await getQualityVariants(url, window);
    logToFile(`Found ${variants.length} quality variants`);
    return variants;
  } catch (error: any) {
    logToFile(`Error getting variants: ${error.message}`);
    return [];
  }
});

ipcMain.handle('start-download', async (event, { url, filename, quality }) => {
  logToFile(`IPC: start-download - ${filename} @ ${quality || 'default'}`);
  logToFile(`Download URL: ${url.substring(0, 150)}`);
  const window = BrowserWindow.fromWebContents(event.sender);
  
  // Always save as MKV (bundled FFmpeg handles conversion)
  const baseName = filename.replace(/\.[^/.]+$/, '');
  const finalFilename = `${baseName}.mkv`;
  
  const { filePath } = await dialog.showSaveDialog(window!, {
    title: 'Save Video as MKV',
    defaultPath: path.join(app.getPath('downloads'), finalFilename),
    filters: [
      { name: 'Matroska Video (MKV)', extensions: ['mkv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!filePath) {
    return { success: false, error: 'Cancelled' };
  }
  
  // Create download item
  const downloadId = `dl-${Date.now()}`;
  const downloadItem: DownloadItem = {
    id: downloadId,
    filename: path.basename(filePath),
    url,
    quality,
    status: 'fetching',
    progress: 0,
    downloadedBytes: 0,
    startTime: Date.now()
  };
  
  addDownload(downloadItem);
  event.sender.send('downloads-updated', getDownloadsList());
  
  try {
    const result = await downloadStream(url, filePath, (progress) => {
      // Update with estimated quality from bitrate analysis
      updateDownload(downloadId, {
        status: progress.status,
        progress: progress.progress,
        downloadedBytes: progress.downloadedBytes || 0,
        filePath: progress.filePath,
        error: progress.error,
        estimatedQuality: progress.estimatedQuality,
        bitrateMbps: progress.bitrateMbps
      });
      
      event.sender.send('download-progress', { id: downloadId, ...progress });
      event.sender.send('downloads-updated', getDownloadsList());
    }, window!);
    
    // Update with final quality info
    updateDownload(downloadId, { 
      filename: path.basename(result.filePath),
      estimatedQuality: result.estimatedQuality,
      bitrateMbps: result.bitrateMbps
    });
    event.sender.send('downloads-updated', getDownloadsList());
    
    logToFile(`Download complete: ${result.filePath} - Quality: ${result.estimatedQuality} @ ${result.bitrateMbps.toFixed(2)} Mbps`);
    return { success: true, filePath: result.filePath, downloadId, quality: result.estimatedQuality };
  } catch (error: any) {
    logToFile(`Download error: ${error.message}`);
    updateDownload(downloadId, { status: 'error', error: error.message });
    event.sender.send('downloads-updated', getDownloadsList());
    return { success: false, error: error.message, downloadId };
  }
});

ipcMain.handle('cancel-download', async () => {
  cancelDownload();
  return { success: true };
});

ipcMain.handle('get-downloads-list', async () => {
  return getDownloadsList();
});

ipcMain.handle('remove-download', async (event, { id }) => {
  removeDownload(id);
  event.sender.send('downloads-updated', getDownloadsList());
  return { success: true };
});

ipcMain.handle('clear-completed-downloads', async (event) => {
  clearCompletedDownloads();
  event.sender.send('downloads-updated', getDownloadsList());
  return { success: true };
});

ipcMain.handle('clear-captured-urls', async (event) => {
  const windowId = String(BrowserWindow.fromWebContents(event.sender)?.id || 'default');
  clearCapturedStreams(windowId);
  return { success: true };
});

logToFile('Download IPC handlers registered');
console.log('[MAIN] Download IPC handlers registered');

// Menu setup
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [new MenuItem({ label: 'Quit App', role: 'quit' })];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
  { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
  { role: 'viewMenu' },
  {
    label: 'Developer',
    submenu: [{
      label: 'Toggle DevTools',
      accelerator: 'Ctrl+Shift+I',
      click: (item, focusedWindow) => focusedWindow?.webContents.toggleDevTools(),
    }],
  },
];

console.log('[MAIN] Menu templates created');

const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();
console.log('[MAIN] Capacitor config loaded');

const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate);
console.log('[MAIN] ElectronCapacitorApp initialized');

if (capacitorFileConfig.electron?.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, {
    customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp',
  });
}

if (electronIsDev) {
  setupReloadWatcher(myCapacitorApp);
  console.log('[MAIN] Reload watcher set up');
}

// Run Application
(async () => {
  await app.whenReady();
  setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
  
  const preloadPath = path.join(app.getAppPath(), 'build', 'src', 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  logToFile(`Preload path: ${preloadPath}`);
  logToFile(`Preload exists: ${preloadExists}`);
  
  await myCapacitorApp.init();
  
  const mainWindow = myCapacitorApp.getMainWindow();
  if (mainWindow) {
    setupNetworkInterception(mainWindow);
    logToFile('Network interception enabled');
    console.log('[MAIN] Stream capture enabled');
  }
  
  logToFile('Application initialized');
  console.log('[MAIN] Application initialized and content loaded');
})();

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async function () {
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

ipcMain.on('m3u8-content', (event, { url, size }) => {
  logToFile(`IPC: m3u8-content - ${url.substring(0, 80)}, size: ${size}`);
  
  try {
    event.sender.send('stream-captured', {
      url,
      type: 'hls',
      timestamp: Date.now(),
      ready: true
    });
  } catch (e) {
    logToFile(`Failed to forward stream-captured: ${e}`);
  }
});

ipcMain.on('m3u8-captured', (event, { url, size }) => {
  logToFile(`IPC: m3u8-captured - ${url.substring(0, 80)}, size: ${size}`);
});
