'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { WatchlistProvider } from '@/context/watchlist-context';
import { DismissedProvider } from '@/context/dismissed-context';
import { SourceProvider } from '@/context/source-context';
import { LoadingBar } from '@/components/layout/loading-bar';

export function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isWatchPage = pathname?.startsWith('/watch/');

  return (
    <Suspense>
      <SourceProvider>
        <DismissedProvider>
          <WatchlistProvider>
            <Suspense>
                <LoadingBar />
            </Suspense>
            {!isWatchPage && <Header />}
            <main>{children}</main>
            <Toaster />
          </WatchlistProvider>
        </DismissedProvider>
      </SourceProvider>
    </Suspense>
  );
}
