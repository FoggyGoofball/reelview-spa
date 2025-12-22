import React, { useEffect, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

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
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace', backgroundColor: '#000', minHeight: '100vh' }}>
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

console.log('[APP] Importing page components...')

// Import all page components from pages/ (Vite-native)
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
console.log('[APP] Starting ReelView initialization...')

// Detect platform
const isElectron = typeof window !== 'undefined' && !!(window as any).electronDownload

console.log('[APP] Platform detection: isElectron =', isElectron)
console.log('[APP] Skipping overlay-neutralizer - will re-enable after fixing root cause')

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
    console.log('[APP] React mounted - overlay-neutralizer disabled for now')
    // Overlay-neutralizer causes crash after ~1 second, disable it temporarily
    // TODO: Fix overlay-neutralizer and re-enable
  }, [])

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
