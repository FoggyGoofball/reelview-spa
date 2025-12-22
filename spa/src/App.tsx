import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

// Comprehensive error boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ERROR BOUNDARY] Caught error:', error)
    console.error('[ERROR BOUNDARY] Error info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h1>React Error</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      )
    }

    return this.props.children
  }
}

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

// Import all page components from pages/ (Vite-native)
console.log('[APP] Importing page components...')

import Home from './pages/Home'
import Movies from './pages/Movies'
import TV from './pages/TV'
import Anime from './pages/Anime'
import Watch from './pages/Watch'
import Search from './pages/Search'
import Watchlist from './pages/Watchlist'
import History from './pages/History'
import Media from './pages/Media'
import Downloads from './pages/Downloads'

console.log('[APP] ? All page components imported successfully')

// Comprehensive logging setup
console.log('[APP] Starting ReelView initialization...')

// Detect platform - Capacitor is Android ONLY, NOT Electron or web
const isElectron = typeof window !== 'undefined' && !!(window as any).electronDownload
const isAndroid = !isElectron && typeof window !== 'undefined' && Capacitor.getPlatform() === 'android'

console.log('[APP] Platform detection:', { isElectron, isAndroid, platform: Capacitor.getPlatform() })

// Initialize ad-blocking and stream detection systems
try {
  console.log('[APP] Initializing ad-capture system...')
  initializeAdCapture({
    enableLogging: isAndroid,
    closureDelay: 600,
    muteAudio: true,
    maxConcurrentAds: 5,
  })
  console.log('[APP] ? Ad-capture initialized')
} catch (error) {
  console.error('[APP] ? Ad-capture initialization failed:', error)
}

try {
  console.log('[APP] Initializing overlay-neutralizer system...')
  initializeOverlayNeutralizer({
    enableLogging: isAndroid,
    playerZIndex: 9999,
    interceptorZIndex: -1,
    watchSubtree: true,
    watchAttributes: true,
    debounceMs: 50,
  })
  console.log('[APP] ? Overlay-neutralizer initialized')
} catch (error) {
  console.error('[APP] ? Overlay-neutralizer initialization failed:', error)
}

// Initialize Android stream detector (ONLY on Android, never on Electron)
if (isAndroid) {
  try {
    console.log('[APP] Initializing Android stream detector...')
    initializeAndroidStreamDetector()
    console.log('[APP] ? Android stream detector initialized')
  } catch (error) {
    console.error('[APP] ? Android stream detector initialization failed:', error)
  }
}

console.log('[APP] All systems initialized')

function ClientLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch')

  console.log('[LAYOUT] Rendering ClientLayout, path:', location.pathname)

  try {
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
  } catch (error) {
    console.error('[LAYOUT] Error rendering ClientLayout:', error)
    throw error
  }
}

function AppRoutes() {
  const location = useLocation()

  console.log('[ROUTES] Current route:', location.pathname)

  useEffect(() => {
    // Scroll to top on route change
    window.scrollTo(0, 0)
  }, [location.pathname])

  try {
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
        <Route path="/media/:media_type/:id" element={<Media />} />
        <Route path="/downloads" element={<Downloads />} />
        {/* Fallback for dynamic routes */}
        <Route path="*" element={<Home />} />
      </Routes>
    )
  } catch (error) {
    console.error('[ROUTES] Error rendering routes:', error)
    throw error
  }
}

export default function App() {
  console.log('[APP] Rendering App component')

  useEffect(() => {
    // ONLY initialize Capacitor on Android, NOT on Electron or web
    if (!isAndroid) {
      console.log('[APP] Skipping Capacitor initialization (not Android platform)')
      return
    }

    console.log('[APP] App mounted, initializing Capacitor (Android only)...')
    
    const initCapacitor = async () => {
      try {
        const { App: CapacitorApp } = await import('@capacitor/app')
        
        CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          console.log('[CAPACITOR] App state changed:', isActive)
        })

        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          console.log('[CAPACITOR] Back button pressed, canGoBack:', canGoBack)
          if (!canGoBack) {
            CapacitorApp.exitApp()
          }
        })

        console.log('[APP] ? Capacitor listeners registered')
      } catch (error) {
        console.log('[APP] Capacitor initialization failed (expected on non-Android):', error)
      }
    }

    initCapacitor()
  }, []) // Empty dependency array - run once on mount

  try {
    return (
      <ErrorBoundary>
        <BrowserRouter basename="/">
          <ClientLayout>
            <AppRoutes />
          </ClientLayout>
        </BrowserRouter>
      </ErrorBoundary>
    )
  } catch (error) {
    console.error('[APP] Error rendering App:', error)
    throw error
  }
}
