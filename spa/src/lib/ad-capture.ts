/**
 * Ad Capture System
 * 
 * Intercepts popup ads and captures them in invisible jails.
 * Works on both Android (Capacitor) and Desktop (Electron).
 */

export interface AdCaptureConfig {
  enableLogging: boolean;
  closureDelay: number;
  muteAudio: boolean;
  maxConcurrentAds: number;
}

const defaultConfig: AdCaptureConfig = {
  enableLogging: true,
  closureDelay: 600,
  muteAudio: true,
  maxConcurrentAds: 5,
};

let config: AdCaptureConfig = { ...defaultConfig };
let originalWindowOpen: typeof window.open | null = null;
let adJails: HTMLIFrameElement[] = [];

function log(...args: any[]) {
  if (config.enableLogging) {
    console.log('[AD_CAPTURE]', ...args);
  }
}

function isInternalUrl(url: string): boolean {
  const lowerUrl = (url || '').toLowerCase();
  return (
    lowerUrl.startsWith('about:blank') ||
    lowerUrl.startsWith('https://localhost') ||
    lowerUrl.startsWith('http://localhost') ||
    lowerUrl.startsWith('capacitor://localhost') ||
    lowerUrl.startsWith('data:') ||
    lowerUrl.startsWith('#')
  );
}

/**
 * Check if URL is from an allowed embed provider
 */
function isEmbedProviderUrl(url: string): boolean {
  const embedProviders = [
    'play.xpass.top', 'xpass.top',
    'vidsrc.net', 'vidsrc.me', 'vidsrc.xyz', 'vidsrc.in', 'vidsrc.pm', 'vidsrc.to',
    'vidlink.pro', '2embed.org', '2embed.to', '2embed.cc',
    'autoembed.to', 'autoembed.cc',
    'movierulz', 'gomovies', 'fmovies', 'putlocker',
    'vidcloud', 'vidplay', 'filemoon', 'streamwish',
    'doodstream', 'upstream', 'mixdrop', 'mp4upload',
    'streamsb', 'streamtape', 'fembed', 'evoload',
    'reelview.localhost', 'localhost',
  ];
  
  const lowerUrl = (url || '').toLowerCase();
  return embedProviders.some(provider => lowerUrl.includes(provider));
}

/**
 * Check if URL is likely an ad
 */
function isLikelyAdUrl(url: string): boolean {
  const adPatterns = [
    'doubleclick', 'googlesyndication', 'googleadservices',
    'facebook.com/tr', 'analytics', 'tracker',
    'adnxs', 'criteo', 'taboola', 'outbrain',
    'popads', 'popcash', 'popunder', 'propeller',
    'exoclick', 'juicyads', 'trafficjunky',
    'ad.', 'ads.', '/ad/', '/ads/', 'banner',
    'affiliate', 'click.', 'track.',
  ];
  
  const lowerUrl = (url || '').toLowerCase();
  return adPatterns.some(pattern => lowerUrl.includes(pattern));
}

/**
 * Create an invisible jail iframe to capture an ad/external navigation
 */
function captureAdInIframe(url: string): Window | null {
  if (!url) return null;
  log('Capturing external/ad URL in jail:', url.substring(0, 100));
  
  // Limit concurrent ads
  if (adJails.length >= config.maxConcurrentAds) {
    const oldest = adJails.shift();
    if (oldest && oldest.parentNode) {
      oldest.parentNode.removeChild(oldest);
    }
  }
  
  // Create invisible container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    z-index: -9999;
    opacity: 0;
  `;
  
  // Create iframe jail
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 1px;
    height: 1px;
    border: none;
    visibility: hidden;
    pointer-events: none;
  `;
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('allow', 'autoplay');
  iframe.src = url;

  // best-effort mute for same-origin iframe docs
  iframe.addEventListener('load', () => {
    if (!config.muteAudio) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const media = doc.querySelectorAll('video,audio') as NodeListOf<HTMLMediaElement>;
      media.forEach((m) => {
        m.muted = true;
        m.volume = 0;
        try { m.pause(); } catch {}
      });
    } catch {}
  });
  
  container.appendChild(iframe);
  document.body.appendChild(container);
  adJails.push(iframe);
  
  // Schedule cleanup
  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
      log('Ad jail destroyed after', config.closureDelay, 'ms');
    }
    const index = adJails.indexOf(iframe);
    if (index > -1) {
      adJails.splice(index, 1);
    }
  }, config.closureDelay);
  
  return iframe.contentWindow;
}

/**
 * Intercept window.open calls
 */
function interceptWindowOpen() {
  if (originalWindowOpen) return; // Already intercepted
  
  originalWindowOpen = window.open;
  
  window.open = function(url?: string | URL, target?: string, features?: string): Window | null {
    const urlString = url?.toString() || '';
    
    log('window.open intercepted:', urlString.substring(0, 100));
    
    // Allow empty/about:blank/internal only
    if (!urlString || isInternalUrl(urlString)) {
      return originalWindowOpen!.call(window, url, target, features);
    }

    // Never open external tabs/windows directly. Jail them all.
    if (isLikelyAdUrl(urlString)) {
      log('Jailing likely ad URL:', urlString);
    } else if (isEmbedProviderUrl(urlString)) {
      log('Jailing embed popup URL (preventing external tab):', urlString);
    } else {
      log('Jailing unknown external URL:', urlString);
    }
    return captureAdInIframe(urlString);
  };
  
  log('window.open intercepted');
}

/**
 * Block location changes from ads
 */
function blockLocationChanges() {
  try {
    const originalAssign = window.location.assign;
    window.location.assign = function(url: string) {
      if (!isInternalUrl(url)) {
        log('Blocked location.assign external URL:', url);
        captureAdInIframe(url);
        return;
      }
      return originalAssign.call(window.location, url);
    };
  } catch (e) {
    // Some browsers don't allow this
  }
}

/**
 * Initialize the Ad Capture system
 */
export function initializeAdCapture(userConfig?: Partial<AdCaptureConfig>) {
  config = { ...defaultConfig, ...userConfig };
  
  log('Initializing Ad Capture System');
  log('Config:', config);
  
  if (typeof window === 'undefined') return;
  
  interceptWindowOpen();
  blockLocationChanges();
  
  // Handle clicks on links with target="_blank"
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    
    if (link && link.target === '_blank') {
      const href = link.href;
      if (!isInternalUrl(href)) {
        e.preventDefault();
        e.stopPropagation();
        captureAdInIframe(href);
        log('Jailed target="_blank" link:', href);
      }
    }
  }, true);
  
  log('Ad Capture System initialized');
}

/**
 * Cleanup all ad jails
 */
export function cleanupAdCapture() {
  adJails.forEach(iframe => {
    if (iframe.parentNode?.parentNode) {
      iframe.parentNode.parentNode.removeChild(iframe.parentNode);
    }
  });
  adJails = [];
  
  if (originalWindowOpen) {
    window.open = originalWindowOpen;
    originalWindowOpen = null;
  }
  
  log('Ad Capture System cleaned up');
}
