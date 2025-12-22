'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, X, CheckCircle, XCircle, Loader2, Clock, HardDrive, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { getDownloadAPI } from '@/lib/unified-download';

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

const api = getDownloadAPI();

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeDeleteFile, setRemoveDeleteFile] = useState(false);

  const loadList = useCallback(async () => {
    const list = await api.getDownloadsList();
    setDownloads(list || []);
  }, []);

  useEffect(() => {
    loadList();
    const unsub = api.onDownloadsUpdated((list: any[]) => {
      setDownloads(list || []);
    });
    return () => unsub?.();
  }, [loadList]);

  const handleRemove = async (id: string, deleteFile = false) => {
    // show confirm dialog
    setRemoveDeleteFile(deleteFile);
    setRemoveId(id);
  };

  const confirmRemove = async () => {
    if (!removeId) return;
    await api.removeDownload(removeId, removeDeleteFile);
    setRemoveId(null);
    setRemoveDeleteFile(false);
  };

  const cancelRemove = () => {
    setRemoveId(null);
    setRemoveDeleteFile(false);
  };

  const handleClearCompleted = async () => {
    await api.clearCompletedDownloads();
    loadList();
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

        {!api || typeof (window as any).electronDownload === 'undefined' ? (
          <div className="rounded-lg border bg-yellow-500/10 border-yellow-500/30 p-8 text-center">
            <Download className="h-12 w-12 mx-auto mb-4 text-yellow-500 opacity-50" />
            <p className="text-yellow-400 font-medium text-lg">Downloads require the desktop app</p>
            <p className="text-sm text-muted-foreground mt-2">
              The download feature is only available in the Electron desktop application.
            </p>
          </div>
        ) : (
          downloads.length === 0 ? (
            <div className="rounded-lg border border-dashed p-16 text-center">
              <Download className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-medium mb-2">No downloads yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                When you download a video, it will appear here. You can track progress and access completed downloads.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {activeDownloads.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Active Downloads ({activeDownloads.length})
                  </h2>
                  <div className="space-y-3">
                    {activeDownloads.map(download => (
                      <DownloadCard key={download.id} download={download} onRequestRemove={(id)=>handleRemove(id,false)} onRequestDelete={(id)=>handleRemove(id,true)} />
                    ))}
                  </div>
                </section>
              )}

              {completedDownloads.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    History ({completedDownloads.length})
                  </h2>
                  <div className="space-y-3">
                    {completedDownloads.map(download => (
                      <DownloadCard key={download.id} download={download} onRequestRemove={(id)=>handleRemove(id,false)} onRequestDelete={(id)=>handleRemove(id,true)} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        )}

        <AlertDialog open={!!removeId}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove download?</AlertDialogTitle>
              <AlertDialogDescription>
                Do you want to remove this download from the list, or delete the file from disk?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelRemove}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={async ()=>{ await api.removeDownload(removeId!, false); confirmRemove(); }}>Remove from list</AlertDialogAction>
              <AlertDialogAction onClick={async ()=>{ await api.removeDownload(removeId!, true); confirmRemove(); }}>Delete file & remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}

function DownloadCard({ download, onRequestRemove, onRequestDelete }: { download: DownloadItem; onRequestRemove: (id:string)=>void; onRequestDelete: (id:string)=>void }) {
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
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 hover:bg-red-500/20 hover:text-red-400" onClick={()=>onRequestRemove(download.id)}>
                <X className="h-4 w-4" />
              </Button>
              {download.filePath && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={()=>{ window.electronDownload?.openFile?.(download.filePath); }}>
                  <HardDrive className="h-4 w-4" />
                </Button>
              )}
            </div>
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
