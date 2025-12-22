'use client';

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getDownloadAPI, isDownloadAvailable } from '@/lib/unified-download';

export function DownloadButton({ url, filename }: { url: string; filename?: string }) {
  const handleClick = useCallback(async () => {
    if (!isDownloadAvailable()) return;
    const api = getDownloadAPI();
    const baseName = filename || `video_${Date.now()}.mkv`;
    const res = await api.startDownload(url, baseName);
    if (res?.success) {
      alert('Download started');
    } else {
      alert('Download failed: ' + (res?.error || 'unknown'));
    }
  }, [url, filename]);

  if (!isDownloadAvailable()) return null;

  return (
    <Button variant="ghost" size="icon" onClick={handleClick}>
      <Download className="h-4 w-4" />
    </Button>
  );
}
