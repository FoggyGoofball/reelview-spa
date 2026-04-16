
import React, { useState, useEffect, useCallback } from 'react';
import { getWatchHistory, setWatchHistory } from '@/lib/client-api';
import type { WatchProgress } from '@/lib/data';
import { History, Upload, Download } from 'lucide-react';
import { WatchHistoryCard } from '@/components/video/watch-history-card';
import { DismissedCarousel } from '@/components/video/dismissed-carousel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { downloadRemoteHistory, mergeWatchHistories, uploadMergedHistory } from '@/lib/history-sync';

export default function WatchHistoryPage() {
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const refreshHistory = useCallback(() => {
    const rawHistory = getWatchHistory();
    const sortedHistory = Object.values(rawHistory).sort((a, b) => (b.last_updated || 0) - (a.last_updated || 0));
    setHistory(sortedHistory);
  }, []);

  useEffect(() => {
    setIsMounted(true);
    refreshHistory();

    const handleHistoryUpdated = () => {
      refreshHistory();
    };

    window.addEventListener('history-updated', handleHistoryUpdated);
    return () => {
      window.removeEventListener('history-updated', handleHistoryUpdated);
    };
  }, [refreshHistory]);

  const promptIdentifier = (actionLabel: 'upload' | 'download'): string | null => {
    const entered = window.prompt(`Enter sync identifier for ${actionLabel}:`);
    if (entered == null) return null;
    const trimmed = entered.trim();
    if (!trimmed) {
      toast({
        title: 'Identifier required',
        description: 'Please enter a valid identifier.',
        variant: 'destructive',
      });
      return null;
    }
    return trimmed;
  };

  const handleUpload = async () => {
    const identifier = promptIdentifier('upload');
    if (!identifier) return;

    try {
      setIsUploading(true);
      const localHistory = getWatchHistory();
      const result = await uploadMergedHistory(identifier, localHistory);
      setWatchHistory(result.merged);

      toast({
        title: 'History uploaded',
        description: `Synced ${result.mergedCount} title(s).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    const identifier = promptIdentifier('download');
    if (!identifier) return;

    try {
      setIsDownloading(true);
      const localHistory = getWatchHistory();
      const remoteHistory = await downloadRemoteHistory(identifier);
      const result = mergeWatchHistories(localHistory, remoteHistory);

      setWatchHistory(result.merged);

      toast({
        title: 'History downloaded',
        description: `Merged ${result.mergedCount} title(s).`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download failed.';
      toast({
        title: 'Download failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="container max-w-screen-2xl py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
          <History className="h-8 w-8 text-primary" /> Your Watch History
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[2/3] w-full rounded-lg bg-muted animate-pulse"></div>
              <div className="h-5 w-3/4 rounded-md bg-muted animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-2xl py-8 md:py-12">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <History className="h-8 w-8 text-primary" /> Your Watch History
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={isDownloading || isUploading}>
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Data'}
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || isDownloading}>
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Data'}
          </Button>
        </div>
      </div>
      {history.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
          {history.map((item, index) => (
            <div key={`${item.id}-${item.type}-${index}`} className="flex-shrink-0">
              <WatchHistoryCard item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-secondary rounded-lg">
          <p className="text-lg text-muted-foreground">Your watch history is empty.</p>
          <p className="text-sm text-muted-foreground/70">Start watching videos to see them here.</p>
        </div>
      )}
      <div className="mt-12">
        <DismissedCarousel />
      </div>
    </div>
  );
}
