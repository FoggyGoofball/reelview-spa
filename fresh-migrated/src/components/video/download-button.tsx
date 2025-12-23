'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable } from '@/lib/unified-download';

function sanitizeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
}

export function DownloadButton({ suggestedFilename }: { suggestedFilename?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [capturedStreams, setCapturedStreams] = useState<any[]>([]);

  useEffect(() => {
    if (!isDownloadAvailable()) return;
    const api = getDownloadAPI();
    let unsubStream: (() => void) | undefined;
    let unsubAllStreams: (() => void) | undefined;

    try {
      if (typeof api.onStreamCaptured === 'function') {
        unsubStream = api.onStreamCaptured((stream: any) => {
          try {
            setCapturedStreams(prev => {
              const next = [stream, ...prev].slice(0, 10);
              return next;
            });
          } catch (e) {
            console.error('[DOWNLOAD] onStreamCaptured handler error', e);
          }
        });
      }

      if (typeof api.onCapturedStreamsList === 'function') {
        unsubAllStreams = api.onCapturedStreamsList((streams: any[]) => {
          try {
            setCapturedStreams(streams || []);
          } catch (e) {
            console.error('[DOWNLOAD] onCapturedStreamsList handler error', e);
          }
        });
      }
    } catch (e) {
      console.error('[DOWNLOAD] failed to subscribe to download API events', e);
    }

    return () => { try { unsubStream?.(); } catch {} try { unsubAllStreams?.(); } catch {} };
  }, []);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setMessage('Starting...');

    try {
      const platform = (typeof navigator !== 'undefined' && (navigator.platform || 'web')) || 'web';
      setMessage(`Platform: ${platform}`);

      if (!isDownloadAvailable()) {
        setMessage('Downloads not available on this platform');
        setIsLoading(false);
        return;
      }

      const api = getDownloadAPI();

      let streams = await api.getCapturedStreams();
      setMessage(`Found ${streams?.length || 0} streams`);

      if ((!streams || streams.length === 0) && typeof api.requestCapturedStreamsPush === 'function') {
        await api.requestCapturedStreamsPush();
        await new Promise(res => setTimeout(res, 200));
        if (capturedStreams && capturedStreams.length > 0) {
          streams = capturedStreams;
        }
      }

      if ((!streams || streams.length === 0)) {
        for (let i = 0; i < 3; i++) {
          await new Promise(res => setTimeout(res, 500));
          try {
            const retry = await api.getCapturedStreams();
            if (retry && retry.length > 0) { streams = retry; break; }
          } catch (e) {}
        }
      }

      if ((!streams || streams.length === 0) && capturedStreams.length > 0) {
        streams = capturedStreams;
      }

      if ((!streams || streams.length === 0)) {
        setMessage('No streams captured - play the video first');
        setIsLoading(false);
        return;
      }

      const sourceList = (streams && streams.length > 0) ? streams : capturedStreams;
      const raw = sourceList[0];
      const url = typeof raw === 'string' ? raw : raw?.url;

      if (!url) {
        setMessage('Could not determine a stream URL');
        setIsLoading(false);
        return;
      }

      // Suggested filename: prefer provided suggestedFilename prop; otherwise try to derive from watch page context
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
            // attempt to derive title from DOM if available
            const titleEl = document.querySelector('h1') || document.querySelector('title');
            const titleText = (titleEl?.textContent || '').trim() || `series_${id}`;
            const sP = String(s).padStart(2, '0');
            const eP = String(e).padStart(2, '0');
            suggestedName = `${titleText}_S${sP}E${eP}`;
          }
        } catch (ex) {}
      }

      suggestedName = sanitizeFilename(suggestedName);

      setMessage('Starting download...');

      const result = await api.startDownload(url, suggestedName);
      setMessage(result?.success ? 'Download started!' : `Error: ${result?.error || 'unknown'}`);
    } catch (e: any) {
      setMessage(`Error: ${e?.message || e}`);
    } finally {
      setIsLoading(false);
    }
  }, [capturedStreams, suggestedFilename]);

  if (!isDownloadAvailable()) return null;

  return (
    <div className="flex items-center">
      <Button variant="ghost" size="icon" onClick={handleClick} title={suggestedFilename ? `Download as ${suggestedFilename}` : 'Download'}>
        <Download className="h-4 w-4" />
      </Button>
      {message && <div className="ml-2 text-xs text-muted-foreground">{message}</div>}
    </div>
  );
}
