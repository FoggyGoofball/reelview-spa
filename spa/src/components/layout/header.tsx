'use client';

import { Logo } from "./logo";
import { MainNav } from "./main-nav";
import { SearchInput } from "../search/search-input";
import { MobileNav } from "./mobile-nav";
import { SourceSelector } from "./source-selector";
import { useApiKeyDialog } from '@/context/api-key-dialog-context';
import { Button } from '@/components/ui/button';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBuildInfo } from '@/lib/unified-download';

export function Header() {
  const { openDialog } = useApiKeyDialog();
  const [buildInfo, setBuildInfo] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await (window as any).electronDownload?.getBuildInfo?.() || await getBuildInfo?.();
        if (!mounted) return;
        setBuildInfo(info);
        console.log('[BUILD] Running build:', info);
      } catch (e) {
        console.error('[BUILD] getBuildInfo error', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Logo />
        <div className="ml-auto flex items-center md:ml-8">
          <div className="hidden md:flex md:items-center md:gap-4">
            <MainNav />
            <SourceSelector />
            <Button variant="ghost" size="sm" className="ml-2" onClick={openDialog}>
              Change API Key
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <SearchInput />
          </div>
          <div className="md:hidden ml-4">
             <MobileNav />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between p-4 bg-black/80">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-white font-bold">ReelView</Link>
          {buildInfo && (
            <div className="ml-4 text-xs text-gray-300">
              Build: <span id="build-hash" className="font-mono">{buildInfo.buildHash || 'local'}</span>
              <button
                onClick={() => { navigator.clipboard?.writeText(JSON.stringify(buildInfo)); }}
                className="ml-2 text-xs text-primary underline"
              >Copy</button>
            </div>
          )}
        </div>
        <div />
      </div>
    </header>
  );
}
