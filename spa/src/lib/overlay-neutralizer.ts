/**
 * Overlay Neutralizer
 * 
 * Watches for click-catcher overlays injected by video sites
 * and neutralizes them by manipulating z-index.
 */

export interface OverlayNeutralizerConfig {
  enableLogging: boolean;
  playerZIndex: number;
  interceptorZIndex: number;
  watchSubtree: boolean;
  watchAttributes: boolean;
  debounceMs: number;
}

const defaultConfig: OverlayNeutralizerConfig = {
  enableLogging: true,
  playerZIndex: 9999,
  interceptorZIndex: -1,
  watchSubtree: true,
  watchAttributes: true,
  debounceMs: 50,
};

let config: OverlayNeutralizerConfig = { ...defaultConfig };
let observer: MutationObserver | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function log(...args: any[]) {
  if (config.enableLogging) {
    console.log('[OVERLAY-NEUTRALIZER]', ...args);
  }
}

/**
 * Check if element is likely a click interceptor overlay
 */
function isLikelyOverlay(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  
  // Check for full-screen or large overlays
  const isFullScreen = (
    rect.width >= window.innerWidth * 0.8 &&
    rect.height >= window.innerHeight * 0.8
  );
  
  // Check for fixed/absolute positioning
  const isPositioned = ['fixed', 'absolute'].includes(style.position);
  
  // Check for high z-index
  const zIndex = parseInt(style.zIndex) || 0;
  const isHighZ = zIndex > 100;
  
  // Check for transparent/semi-transparent background
  const bgColor = style.backgroundColor;
  const isTransparent = (
    bgColor === 'transparent' ||
    bgColor === 'rgba(0, 0, 0, 0)' ||
    bgColor.includes('rgba') && parseFloat(bgColor.split(',')[3]) < 0.5
  );
  
  // Check for overlay-like class names
  const classNames = element.className.toLowerCase();
  const hasOverlayClass = (
    classNames.includes('overlay') ||
    classNames.includes('click') ||
    classNames.includes('interceptor') ||
    classNames.includes('blocker') ||
    classNames.includes('layer') ||
    classNames.includes('cover')
  );
  
  // Check for empty/minimal content (click catchers usually have no content)
  const hasMinimalContent = element.children.length === 0 && element.textContent?.trim() === '';
  
  // Scoring system
  let score = 0;
  if (isFullScreen) score += 3;
  if (isPositioned) score += 2;
  if (isHighZ) score += 2;
  if (isTransparent) score += 2;
  if (hasOverlayClass) score += 3;
  if (hasMinimalContent) score += 2;
  
  return score >= 5;
}

/**
 * Check if element is a video player
 */
function isVideoPlayer(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  
  const tagName = element.tagName.toLowerCase();
  const classNames = element.className.toLowerCase();
  const id = element.id?.toLowerCase() || '';
  
  // Direct video elements
  if (tagName === 'video' || tagName === 'iframe') return true;
  
  // Common player class/id patterns
  const playerPatterns = [
    'player', 'video', 'plyr', 'jw-', 'vjs-', 'html5-video',
    'video-js', 'flowplayer', 'mejs', 'mediaelement',
  ];
  
  return playerPatterns.some(pattern => 
    classNames.includes(pattern) || id.includes(pattern)
  );
}

/**
 * Neutralize a detected overlay
 */
function neutralizeOverlay(element: HTMLElement) {
  log('Neutralizing overlay:', element.tagName, element.className);
  
  // Push overlay behind everything
  element.style.setProperty('z-index', String(config.interceptorZIndex), 'important');
  element.style.setProperty('pointer-events', 'none', 'important');
  element.style.setProperty('visibility', 'hidden', 'important');
}

/**
 * Elevate a video player
 */
function elevatePlayer(element: HTMLElement) {
  log('Elevating player:', element.tagName, element.className);
  
  element.style.setProperty('z-index', String(config.playerZIndex), 'important');
  element.style.setProperty('position', 'relative', 'important');
}

/**
 * Scan and process all elements
 */
function processDocument() {
  // Find and elevate video players
  const videos = document.querySelectorAll('video, iframe, [class*="player"], [id*="player"]');
  let elevatedCount = 0;
  
  videos.forEach(element => {
    if (isVideoPlayer(element) && element instanceof HTMLElement) {
      elevatePlayer(element);
      elevatedCount++;
    }
  });
  
  if (elevatedCount > 0) {
    log(`Elevated ${elevatedCount} player elements`);
  }
  
  // Find and neutralize overlays
  const allElements = document.querySelectorAll('div, span, section, aside');
  let neutralizedCount = 0;
  
  allElements.forEach(element => {
    if (isLikelyOverlay(element) && element instanceof HTMLElement) {
      neutralizeOverlay(element);
      neutralizedCount++;
    }
  });
  
  if (neutralizedCount > 0) {
    log(`Neutralized ${neutralizedCount} overlay elements`);
  }
}

/**
 * Handle DOM mutations
 */
function handleMutations(mutations: MutationRecord[]) {
  // Debounce to avoid excessive processing
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    let hasNewElements = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        hasNewElements = true;
      }
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        if (target && mutation.attributeName === 'style') {
          // Check if z-index was modified
          if (isLikelyOverlay(target)) {
            neutralizeOverlay(target);
          }
        }
      }
    });
    
    if (hasNewElements) {
      processDocument();
    }
  }, config.debounceMs);
}

/**
 * Initialize the Overlay Neutralizer
 */
export function initializeOverlayNeutralizer(userConfig?: Partial<OverlayNeutralizerConfig>) {
  config = { ...defaultConfig, ...userConfig };
  
  log('Initializing Overlay Neutralizer');
  log('Config:', config);
  
  // Only run in browser
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  // Initial scan
  processDocument();
  
  // Set up MutationObserver
  observer = new MutationObserver(handleMutations);
  
  observer.observe(document.body, {
    childList: true,
    subtree: config.watchSubtree,
    attributes: config.watchAttributes,
    attributeFilter: ['style', 'class'],
  });
  
  log('MutationObserver started');
  
  // Also run periodically as backup
  setInterval(processDocument, 2000);
  
  log('Overlay Neutralizer initialized');
}

/**
 * Stop the Overlay Neutralizer
 */
export function stopOverlayNeutralizer() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  log('Overlay Neutralizer stopped');
}
