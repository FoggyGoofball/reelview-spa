import React, { useCallback, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable, getPlatform } from '@/lib/unified-download';

// Download button for Watch page - works on Electron and Capacitor
export function DownloadButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [capturedStreams, setCapturedStreams] = useState<any[]>([]);

  useEffect(() => {
    if (!isDownloadAvailable()) return;
    const api = getDownloadAPI();
    const unsub = api.onStreamCaptured((stream: any) => {
      try {
        console.log('[DOWNLOAD] onStreamCaptured event:', stream);
        setCapturedStreams(prev => {
          const next = [stream, ...prev].slice(0, 10);
          return next;
        });
      } catch (e) {
        console.error('[DOWNLOAD] onStreamCaptured handler error', e);
      }
    });

    const unsubAll = api.onCapturedStreamsList((streams:any[]) => {
      try {
        console.log('[DOWNLOAD] onCapturedStreamsList event, count=', streams?.length);
        setCapturedStreams(streams || []);
      } catch (e) {
        console.error('[DOWNLOAD] onCapturedStreamsList handler error', e);
      }
    });

    return () => { unsub?.(); unsubAll?.(); };
  }, []);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setMessage('Starting...');
    console.log('=== DOWNLOAD CLICKED ===');

    try {
      const platform = getPlatform();
      console.log('[DOWNLOAD] Platform:', platform);
      setMessage(`Platform: ${platform}`);

      if (!isDownloadAvailable()) {
        setMessage('Downloads not available on this platform');
        setIsLoading(false);
        return;
      }

      const api = getDownloadAPI();
      console.log('[DOWNLOAD] Got API:', !!api, api);
      setMessage('Got API...');

      if (!api?.getCapturedStreams) {
        setMessage('No getCapturedStreams method');
        setIsLoading(false);
        return;
      }

      console.log('[DOWNLOAD] Calling getCapturedStreams...');
      setMessage('Fetching streams...');

      const streams = await api.getCapturedStreams();
      console.log('[DOWNLOAD] getCapturedStreams returned:', streams);
      setMessage(`Found ${streams?.length || 0} streams`);

      // If nothing returned, also show any recent events captured via listener
      if ((!streams || streams.length === 0) && capturedStreams.length > 0) {
        console.log('[DOWNLOAD] No streams from API, using capturedStreams from listener:', capturedStreams);
      }

      if ((!streams || streams.length === 0) && capturedStreams.length === 0) {
        setMessage('No streams captured - play the video first');
        setIsLoading(false);
        return;
      }

      // Prefer the API streams; fallback to the listener-captured ones
      const sourceList = (streams && streams.length > 0) ? streams : capturedStreams;
      const raw = sourceList[0];
      const url = typeof raw === 'string' ? raw : raw?.url;

      if (!url) {
        setMessage('Could not determine a stream URL');
        setIsLoading(false);
        return;
      }

      console.log('[DOWNLOAD] Selected URL for download:', url);
      setMessage('Starting download...');

      // Remove quality selection - let the embed/player choose quality. Start download with URL only.
      const result = await api.startDownload(url, `video_${Date.now()}`);
      console.log('[DOWNLOAD] startDownload result:', result);

      setMessage(result?.success ? 'Download started!' : `Error: ${result?.error || 'unknown'}`);
    } catch (e: any) {
      console.error('[DOWNLOAD] ERROR:', e);
      setMessage(`Error: ${e?.message || e}`);
    } finally {
      setIsLoading(false);
    }
  }, [capturedStreams]);

  // Always show on Electron or Capacitor, hide on web
  if (!isDownloadAvailable()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 items-center">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-white hover:bg-white/20"
        title={`Download (${getPlatform()})`}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
      {message && <div className="text-xs text-white bg-black/50 px-2 py-1 rounded max-w-[200px] text-center">{message}</div>}
      {capturedStreams.length > 0 && (
        <div className="text-xs text-muted-foreground mt-1 max-w-[200px] text-center break-words">
          <div className="font-medium">Recent captured stream</div>
          <div className="text-xs">{(capturedStreams[0] as any)?.url ?? JSON.stringify(capturedStreams[0])}</div>
        </div>
      )}
    </div>
  );
}
