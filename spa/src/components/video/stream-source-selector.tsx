'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Loader2, Link2 } from 'lucide-react';
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
      <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto w-64">
        <DropdownMenuLabel className="text-xs">
          {sources.length > 0
            ? `${sources.length} stream source${sources.length !== 1 ? 's' : ''} found`
            : 'No sources found'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sources.map((src, i) => (
          <DropdownMenuItem
            key={`${src.url}-${i}`}
            onClick={() => onSelect(src.url)}
            className="cursor-pointer text-xs flex items-center gap-2"
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
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
