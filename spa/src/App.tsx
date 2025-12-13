import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Import layout and context providers
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/toaster'
import { WatchlistProvider } from '@/context/watchlist-context'
import { DismissedProvider } from '@/context/dismissed-context'
import { SourceProvider } from '@/context/source-context'
import { LoadingBar } from '@/components/layout/loading-bar'

// Import ad-blocking and stream detection systems
import { initializeAdCapture } from '@/lib/ad-capture'
import { initializeOverlayNeutralizer } from '@/lib/overlay-neutralizer'
import { initializeAndroidStreamDetector } from '@/lib/android-stream-detector'

// Import all page components
import Home from './app/page'
import Movies from './app/movies/page'
import TV from './app/tv/page'
import Anime from './app/anime/page'
import Watch from './app/watch/page'
import Search from './app/search/page'
import Watchlist from './app/watchlist/page'
import History from './app/history/page'
import Downloads from './pages/Downloads'

// Initialize ad-blocking and stream detection systems
// IMPORTANT: enableLogging MUST be true for systems to work properly
initializeAdCapture({
  enableLogging: true,
  closureDelay: 600,
  muteAudio: true,
  maxConcurrentAds: 5,
})

initializeOverlayNeutralizer({
  enableLogging: true,
  playerZIndex: 9999,
  interceptorZIndex: -1,
  watchSubtree: true,
  watchAttributes: true,
  debounceMs: 50,
})

// Initialize Android stream detector (only on Android)
if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'android') {
  initializeAndroidStreamDetector()
}

function ClientLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SourceProvider>
        <DismissedProvider>
          <WatchlistProvider>
            <Suspense fallback={null}>
              <LoadingBar />
            </Suspense>
            {!isWatchPage && <Header />}
            <main>{children}</main>
            <Toaster />
          </WatchlistProvider>
        </DismissedProvider>
      </SourceProvider>
    </Suspense>
  )
}

function AppRoutes() {
  const location = useLocation()

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/tv" element={<TV />} />
      <Route path="/anime" element={<Anime />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="/search" element={<Search />} />
      <Route path="/watchlist" element={<Watchlist />} />
      <Route path="/history" element={<History />} />
      <Route path="/downloads" element={<Downloads />} />
      {/* Fallback for dynamic routes */}
      <Route path="*" element={<Home />} />
    </Routes>
  )
}

export default function App() {
  useEffect(() => {
    const initCapacitor = async () => {
      try {
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          console.log('App is active:', isActive)
        })

        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            CapacitorApp.exitApp()
          }
        })
      } catch (error) {
        console.log('Capacitor not available (web mode)')
      }
    }

    initCapacitor()
  }, [])

  return (
    <BrowserRouter basename="/">
      <ClientLayout>
        <AppRoutes />
      </ClientLayout>
    </BrowserRouter>
  )
}
