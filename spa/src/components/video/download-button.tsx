import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable, getPlatform } from '@/lib/unified-download';

// Download button for Watch page
export function DownloadButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    setMessage('Starting...');
    console.log('=== DOWNLOAD CLICKED ===');
    
    try {
      const platform = getPlatform();
      console.log('Platform:', platform);
      setMessage(`Platform: ${platform}`);
      
      if (!isDownloadAvailable()) {
        setMessage('Downloads not available on this platform');
        setIsLoading(false);
        return;
      }

      const api = getDownloadAPI();
      console.log('Got API:', !!api);
      setMessage('Got API...');

      if (!api?.getCapturedStreams) {
        setMessage('No getCapturedStreams method');
        setIsLoading(false);
        return;
      }

      console.log('Calling getCapturedStreams...');
      setMessage('Fetching streams...');
      
      const streams = await api.getCapturedStreams();
      console.log('Got streams:', streams);
      setMessage(`Got ${streams?.length || 0} streams`);

      if (!streams || streams.length === 0) {
        setMessage('No streams captured - play video first');
        setIsLoading(false);
        return;
      }

      const url = typeof streams[0] === 'string' ? streams[0] : streams[0].url;
      console.log('Starting download with URL:', url?.substring(0, 80));
      setMessage('Starting download...');

      const result = await api.startDownload(url, `video_${Date.now()}`, 'auto');
      console.log('Download result:', result);
      
      setMessage(result.success ? 'Download started!' : `Error: ${result.error}`);
    } catch (e: any) {
      console.error('ERROR:', e);
      setMessage(`Error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (!isDownloadAvailable()) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-white hover:bg-white/20"
        title="Download"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </Button>
      {message && <div className="text-xs text-white bg-black/50 px-2 py-1 rounded">{message}</div>}
    </div>
  );
}
