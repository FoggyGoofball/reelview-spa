'use client';

import { useState, useEffect } from 'react';
import { Download, Trash2, X, CheckCircle, XCircle, Loader2, Clock, HardDrive, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  quality?: string;
  resolution?: string;
  detectedQuality?: string;
  estimatedQuality?: string;
  bitrateMbps?: number;
  status: 'idle' | 'fetching' | 'parsing' | 'downloading' | 'merging' | 'converting' | 'complete' | 'error' | 'cancelled';
  progress: number;
  downloadedBytes: number;
  filePath?: string;
  error?: string;
  startTime: number;
}

const isElectron = typeof navigator !== 'undefined' && 
  navigator.userAgent.toLowerCase().includes('electron');

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const statusLabels: Record<string, string> = {
  idle: 'Waiting',
  fetching: 'Fetching Stream...',
  parsing: 'Analyzing...',
  downloading: 'Downloading...',
  merging: 'Merging Segments...',
  converting: 'Converting to MKV...',
  complete: 'Complete',
  error: 'Failed',
  cancelled: 'Cancelled'
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'complete':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
    case 'cancelled':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'downloading':
    case 'fetching':
    case 'parsing':
    case 'merging':
    case 'converting':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    default:
      return <Download className="h-5 w-5 text-muted-foreground" />;
  }
};

// Quality badge component with color coding
function QualityBadge({ download }: { download: DownloadItem }) {
  // Prioritize: estimatedQuality > detectedQuality > resolution > quality
  const displayQuality = download.estimatedQuality || download.detectedQuality || download.resolution || download.quality;
  
  if (!displayQuality || displayQuality === 'Default Quality') return null;
  
  // Determine badge color based on quality
  let badgeClass = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const q = displayQuality.toLowerCase();
  if (q.includes('1080') || q.includes('fhd')) {
    badgeClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  } else if (q.includes('720') || q.includes('hd')) {
    badgeClass = 'bg-green-500/20 text-green-400 border-green-500/30';
  } else if (q.includes('480') || q.includes('sd')) {
    badgeClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  } else if (q.includes('360') || q.includes('low')) {
    badgeClass = 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  } else if (q.includes('4k') || q.includes('2160')) {
    badgeClass = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  } else if (q.includes('240')) {
    badgeClass = 'bg-red-500/20 text-red-400 border-red-500/30';
  }
  
  // Show bitrate if available
  const bitrateText = download.bitrateMbps ? ` (${download.bitrateMbps.toFixed(1)} Mbps)` : '';
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border ${badgeClass}`}>
      <Monitor className="h-3 w-3" />
      {displayQuality}{bitrateText}
    </span>
  );
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);

  useEffect(() => {
    if (!isElectron) return;

    const api = (window as any).electronDownload;
    if (!api) return;

    // Load initial downloads
    api.getDownloadsList().then((list: DownloadItem[]) => {
      console.log('[DOWNLOADS] Loaded downloads:', list);
      setDownloads(list || []);
    });

    // Listen for updates
    const unsub = api.onDownloadsUpdated((list: DownloadItem[]) => {
      console.log('[DOWNLOADS] Updated downloads:', list);
      setDownloads(list || []);
    });

    return () => unsub?.();
  }, []);

  const handleRemove = async (id: string) => {
    const api = (window as any).electronDownload;
    if (api) {
      await api.removeDownload(id);
    }
  };

  const handleClearCompleted = async () => {
    const api = (window as any).electronDownload;
    if (api) {
      await api.clearCompletedDownloads();
    }
  };

  const activeDownloads = downloads.filter(d => 
    d.status === 'downloading' || d.status === 'fetching' || d.status === 'parsing' || d.status === 'merging' || d.status === 'converting'
  );
  const completedDownloads = downloads.filter(d => 
    d.status === 'complete' || d.status === 'error' || d.status === 'cancelled'
  );

  return (
    <div className="min-h-screen bg-background pt-16">
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Download className="h-7 w-7" />
            Downloads
          </h1>
          
          {completedDownloads.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearCompleted}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Completed
            </Button>
          )}
        </div>
        
        {!isElectron && (
          <div className="rounded-lg border bg-yellow-500/10 border-yellow-500/30 p-8 text-center">
            <Download className="h-12 w-12 mx-auto mb-4 text-yellow-500 opacity-50" />
            <p className="text-yellow-400 font-medium text-lg">Downloads require the desktop app</p>
            <p className="text-sm text-muted-foreground mt-2">
              The download feature is only available in the Electron desktop application.
            </p>
          </div>
        )}
        
        {isElectron && downloads.length === 0 && (
          <div className="rounded-lg border border-dashed p-16 text-center">
            <Download className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <h2 className="text-xl font-medium mb-2">No downloads yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              When you download a video, it will appear here. You can track progress and access completed downloads.
            </p>
          </div>
        )}
        
        {isElectron && downloads.length > 0 && (
          <div className="space-y-8">
            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Active Downloads ({activeDownloads.length})
                </h2>
                <div className="space-y-3">
                  {activeDownloads.map(download => (
                    <DownloadCard key={download.id} download={download} onRemove={handleRemove} />
                  ))}
                </div>
              </section>
            )}
            
            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  History ({completedDownloads.length})
                </h2>
                <div className="space-y-3">
                  {completedDownloads.map(download => (
                    <DownloadCard key={download.id} download={download} onRemove={handleRemove} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function DownloadCard({ download, onRemove }: { download: DownloadItem; onRemove: (id: string) => void }) {
  const elapsed = Date.now() - download.startTime;
  const isActive = ['downloading', 'fetching', 'parsing', 'merging', 'converting'].includes(download.status);
  
  return (
    <div className={`rounded-xl border p-5 transition-colors ${
      download.status === 'complete' ? 'bg-green-500/5 border-green-500/20' :
      download.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
      'bg-card hover:bg-accent/50'
    }`}>
      <div className="flex items-start gap-4">
        <div className="mt-1">
          <StatusIcon status={download.status} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Title with Quality Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">{download.filename}</h3>
                <QualityBadge download={download} />
              </div>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  {statusLabels[download.status]}
                </span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 flex-shrink-0 hover:bg-red-500/20 hover:text-red-400"
              onClick={() => onRemove(download.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {isActive && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono font-semibold text-primary">{download.progress}%</span>
              </div>
              <Progress value={download.progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(download.downloadedBytes)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(elapsed)}
                </span>
              </div>
            </div>
          )}
          
          {download.filePath && download.status === 'complete' && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-xs text-muted-foreground mb-1">Saved to:</p>
                <p className="text-sm font-mono text-green-400 break-all">{download.filePath}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-green-400">{formatFileSize(download.downloadedBytes)}</p>
              </div>
            </div>
          )}
          
          {download.error && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{download.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
