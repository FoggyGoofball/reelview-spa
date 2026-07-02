'use client';

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, Search } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ResolvedStream {
  url: string;
  type: string;
  quality: string;
  source: string;
  audioLanguage?: string;
  audioLabel?: string;
}

interface ResolveResponse {
  success: boolean;
  data?: {
    sources: ResolvedStream[];
    message?: string;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchDirectLinksModal({ tmdbId, mediaType }: { tmdbId: string; mediaType: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('1');
  const [resolving, setResolving] = useState(false);
  const [results, setResults] = useState<ResolvedStream[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleOpen = useCallback((stream: ResolvedStream) => {
    const targetUrl = `/watch?id=${tmdbId}&type=${mediaType}&s=${parseInt(season, 10)}&e=${parseInt(episode, 10)}&directUrl=${encodeURIComponent(stream.url)}`;
    navigate(targetUrl);
  }, [navigate, tmdbId, mediaType, season, episode]);

  // Only available for TV/anime
  const isSeries = mediaType === 'tv' || mediaType === 'anime';
  if (!isSeries) return null;

  const handleResolve = async () => {
    if (!season || !episode) return;

    setResolving(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch(apiUrl('/api/resolve-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId,
          type: mediaType === 'anime' ? 'tv' : mediaType,
          season: parseInt(season, 10),
          episode: parseInt(episode, 10),
        }),
      });

      const json: ResolveResponse = await res.json();

      if (!json.success || !json.data) {
        setError(json.error || json.data?.message || 'Failed to resolve stream');
        return;
      }

      if (json.data.sources.length === 0) {
        setError('No direct links found for this episode.');
        return;
      }

      setResults(json.data.sources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setResolving(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state on close
      setTimeout(() => {
        setResults(null);
        setError(null);
        setSeason('1');
        setEpisode('1');
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Search className="mr-2 h-5 w-5" /> Search Direct Links
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Direct Stream Links</DialogTitle>
          <DialogDescription>
            Enter the season and episode number to resolve direct-stream URLs via the ReelView Engine (Consumet + CinePro fallback).
          </DialogDescription>
        </DialogHeader>

        {/* Season & Episode Inputs */}
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="season">Season Number</Label>
            <Input
              id="season"
              type="number"
              min={1}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="episode">Episode Number</Label>
            <Input
              id="episode"
              type="number"
              min={1}
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
        </div>

        {/* Resolve Button */}
        <Button onClick={handleResolve} disabled={resolving || !season || !episode} className="w-full">
          {resolving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resolving...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" /> Resolve Stream
            </>
          )}
        </Button>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mt-2">
            {error}
          </div>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">
              Found {results.length} direct link{results.length > 1 ? 's' : ''}
            </h4>
            {results.map((stream, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {stream.quality || 'Auto'} · {stream.type.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {stream.source}
                    {stream.audioLabel ? ` · ${stream.audioLabel}` : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2 shrink-0"
                  onClick={() => handleOpen(stream)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Open
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="text-xs text-muted-foreground">
          Results are cached for 24 hours.
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
