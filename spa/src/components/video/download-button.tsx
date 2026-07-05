import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable, getPlatform } from '@/lib/unified-download';
import { useToast } from '@/hooks/use-toast';

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
}

export function DownloadButton({ suggestedFilename }: { suggestedFilename?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleClick = useCallback(async () => {
    setIsLoading(true);

    try {
      const platform = getPlatform();
      
      if (!isDownloadAvailable()) {
        toast({
          title: "Downloads not available",
          description: "Download feature is only available on desktop and Android apps",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const api = getDownloadAPI();

      if (typeof api?.getCapturedStreams !== 'function') {
        toast({
          title: "API Error",
          description: "Download API is not available",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Scanning for streams...",
        description: "Looking for video streams on the page",
      });

      let streams = await api.getCapturedStreams!();

      if ((!streams || streams.length === 0)) {
        // Retry a few times
        for (let i = 0; i < 3; i++) {
          await new Promise(res => setTimeout(res, 500));
          try {
            const retry = await api.getCapturedStreams!();
            if (retry && retry.length > 0) { streams = retry; break; }
          } catch { }
        }
      }

      if ((!streams || streams.length === 0)) {
        toast({
          title: "No streams found",
          description: "Please play a video first to capture the stream",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const sourceList = (streams && streams.length > 0) ? streams : [];
      const raw = sourceList[0];
      const url = typeof raw === 'string' ? raw : raw?.url;

      if (!url) {
        toast({
          title: "Invalid stream",
          description: "Could not determine a stream URL",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Derive suggested filename if not provided
      let suggestedName = suggestedFilename || `video_${Date.now()}`;
      if (!suggestedFilename) {
        try {
          const win = window as any;
          const currentLocation = win?.location?.href || '';
          const params = new URLSearchParams(currentLocation.split('?')[1] || '');
          const id = params.get('id');
          const type = params.get('type');
          const s = params.get('s');
          const e = params.get('e');
          if (type && id && (type === 'tv' || type === 'anime') && s && e) {
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const titleText = (titleEl?.textContent || '').trim() || `series_${id}`;
            const sP = String(s).padStart(2, '0');
            const eP = String(e).padStart(2, '0');
            suggestedName = `${titleText}_S${sP}E${eP}`;
          } else {
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const titleText = (titleEl?.textContent || '').trim();
            if (titleText) suggestedName = titleText;
          }
        } catch (ex) {}
      }

      suggestedName = sanitizeFilename(suggestedName);

      toast({
        title: "Starting download",
        description: `Downloading: ${suggestedName}`,
      });

      const result = await api.startDownload(url, suggestedName);

      if (result?.success) {
        toast({
          title: "Download started!",
          description: `${suggestedName} is being downloaded. Check the Downloads page for progress.`,
        });
      } else {
        toast({
          title: "Download failed",
          description: result?.error || "Unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || String(e),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [suggestedFilename, toast]);

  if (!isDownloadAvailable()) return null;

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      variant="ghost"
      size="icon"
      className="h-7 w-7 sm:h-8 sm:w-8 text-white hover:bg-white/20 flex-shrink-0"
      title={`Download (${getPlatform()})`}
    >
      {isLoading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Download className="h-3 w-3 sm:h-4 sm:w-4" />}
    </Button>
  );
}
