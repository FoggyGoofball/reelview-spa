'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface ResolvedStream {
  url: string;
  type: string;
  quality?: string;
  server?: string;
  /** The original (non-proxied) stream URL, for external playback */
  rawUrl?: string;
}

interface StreamSourceSelectorProps {
  sources: ResolvedStream[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  isResolving: boolean;
}

export function StreamSourceSelector({
  sources,
  selectedUrl,
  onSelect,
  isResolving,
}: StreamSourceSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          disabled={isResolving && sources.length === 0}
          className="text-xs py-1 px-2 h-7 sm:h-8 whitespace-nowrap"
        >
          {isResolving && sources.length === 0 ? (
            <>
              <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              <span className="ml-1">Resolving...</span>
            </>
          ) : (
            <>
              <Link2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="ml-1">Sources</span>
              {sources.length > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({sources.length})</span>
              )}
              <ChevronDown className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto w-72">
        <DropdownMenuLabel className="text-xs">
          {sources.length > 0
            ? `${sources.length} stream source${sources.length !== 1 ? 's' : ''} found`
            : 'No sources found'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.map((src, i) => (
          <div
            key={`${src.url}-${i}`}
            className="flex items-center gap-1 px-2 py-1 text-xs group"
          >
            {/* Select button (main click area) */}
            <button
              onClick={() => onSelect(src.url)}
              className="flex items-center gap-2 flex-1 min-w-0 py-1 cursor-pointer rounded hover:bg-white/5"
            >
              {selectedUrl === src.url ? (
                <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : (
                <span className="w-3 flex-shrink-0" />
              )}
              <span className="font-mono text-[10px] uppercase bg-white/10 px-1 rounded flex-shrink-0">
                {src.type}
              </span>
              <span className="truncate flex-1">
                {src.quality || 'auto'}
                {src.server && (
                  <span className="text-gray-400 ml-1">· {src.server}</span>
                )}
              </span>
            </button>
            {/* External link button — opens raw stream URL in new tab */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const urlToOpen = src.rawUrl || src.url;
                window.open(urlToOpen, '_blank', 'noopener,noreferrer');
              }}
              title="Open stream URL directly in new tab (for VLC, IINA, etc.)"
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
