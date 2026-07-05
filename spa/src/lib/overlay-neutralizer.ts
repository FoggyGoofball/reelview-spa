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
  try {
    if (!(element instanceof HTMLElement)) return false;
    
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    // Don't target elements that are clearly part of the main UI
    const id = element.id?.toLowerCase?.() || '';
    const classNames = element.className?.toLowerCase?.() || '';
    
    // Never target these - they're core UI
    if (id === 'root' || classNames.includes('react') || classNames.includes('app')) return false;
    if (classNames.includes('header') || classNames.includes('nav') || classNames.includes('main')) return false;
    if (classNames.includes('button') || classNames.includes('input') || classNames.includes('form')) return false;
    
    // Check for full-screen or large overlays
    const isFullScreen = (
      rect.width >= window.innerWidth * 0.9 &&
      rect.height >= window.innerHeight * 0.9
    );
    
    // Check for fixed/absolute positioning
    const isPositioned = ['fixed', 'absolute'].includes(style.position);
    
    // Check for high z-index (must be very high to be suspicious)
    const zIndex = parseInt(style.zIndex) || 0;
    const isHighZ = zIndex > 1000;
    
    // Check for transparent/semi-transparent background
    const bgColor = style.backgroundColor;
    const isTransparent = (
      bgColor === 'transparent' ||
      bgColor === 'rgba(0, 0, 0, 0)' ||
      (bgColor.includes('rgba') && parseFloat(bgColor.split(',')[3]) < 0.3)
    );
    
    // Check for overlay-like class names (very specific)
    const hasOverlayClass = (
      classNames.includes('overlay') ||
      classNames.includes('interceptor') ||
      classNames.includes('popads') ||
      classNames.includes('popcash')
    );
    
    // Check for empty/minimal content (click catchers usually have no content)
    const hasMinimalContent = element.children.length === 0 && element.textContent?.trim() === '';
    
    // Scoring system - be VERY conservative
    let score = 0;
    if (isFullScreen && isTransparent) score += 4;  // Transparent fullscreen is suspicious
    if (isPositioned && isHighZ && isTransparent) score += 3;  // Fixed with very high z-index and transparent
    if (hasOverlayClass) score += 3;  // Explicit overlay class
    if (hasMinimalContent && isPositioned && isTransparent) score += 2;  // No content + positioned + transparent
    
    // Only treat as overlay if score is high
    return score >= 4;
  } catch (error) {
    log('Error checking if element is overlay:', error);
    return false;
  }
}

/**
 * Check if element is a video player
 */
function isVideoPlayer(element: Element): boolean {
  try {
    if (!(element instanceof HTMLElement)) return false;
    
    const tagName = element.tagName?.toLowerCase?.() || '';
    const classNames = element.className?.toLowerCase?.() || '';
    const id = element.id?.toLowerCase?.() || '';
    
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
  } catch (error) {
    log('Error checking if element is video player:', error);
    return false;
  }
}

/**
 * Neutralize a detected overlay
 */
function neutralizeOverlay(element: HTMLElement) {
  try {
    log('Neutralizing overlay:', element.tagName, element.className);
    
    // Push overlay behind everything - use z-index and pointer-events instead of visibility
    element.style.setProperty('z-index', String(config.interceptorZIndex), 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    // DO NOT use visibility: hidden - it hides the entire element
    // Instead just make it non-interactive
  } catch (error) {
    log('Error neutralizing overlay:', error);
  }
}

/**
 * Elevate a video player
 */
function elevatePlayer(element: HTMLElement) {
  try {
    log('Elevating player:', element.tagName, element.className);
    
    element.style.setProperty('z-index', String(config.playerZIndex), 'important');
    element.style.setProperty('position', 'relative', 'important');
  } catch (error) {
    log('Error elevating player:', error);
  }
}

/**
 * Scan and process all elements
 */
function processDocument() {
  try {
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
  } catch (error) {
    log('Error processing document:', error);
  }
}

/**
 * Handle DOM mutations
 */
function handleMutations(mutations: MutationRecord[]) {
  try {
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
  } catch (error) {
    log('Error handling mutations:', error);
  }
}

/**
 * Initialize the Overlay Neutralizer
 */
export function initializeOverlayNeutralizer(userConfig?: Partial<OverlayNeutralizerConfig>) {
  try {
    config = { ...defaultConfig, ...userConfig };
    
    log('Initializing Overlay Neutralizer');
    log('Config:', config);
    
    // Only run in browser
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      log('Skipping - not in browser environment');
      return;
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        log('DOM ready, starting Overlay Neutralizer');
        startObserver();
      }, { once: true });
    } else {
      // DOM is already ready
      startObserver();
    }
  } catch (error) {
    console.error('[OVERLAY-NEUTRALIZER] Initialization error:', error);
  }
}

function startObserver() {
  try {
    // Initial scan - wait a tick to ensure DOM is ready
    setTimeout(() => {
      processDocument();
    }, 100);
    
    // Set up MutationObserver - but check that document.body exists first
    const targetNode = document.body || document.documentElement;
    
    if (!targetNode) {
      log('No document.body or documentElement available');
      return;
    }
    
    observer = new MutationObserver(handleMutations);
    
    observer.observe(targetNode, {
      childList: true,
      subtree: config.watchSubtree,
      attributes: config.watchAttributes,
      attributeFilter: ['style', 'class'],
    });
    
    log('MutationObserver started');
    
    // Also run periodically as backup
    const intervalId = setInterval(processDocument, 2000);
    
    // Clean up on unload
    window.addEventListener('beforeunload', () => {
      if (observer) observer.disconnect();
      clearInterval(intervalId);
      if (debounceTimer) clearTimeout(debounceTimer);
    }, { once: true });
    
    log('Overlay Neutralizer initialized successfully');
  } catch (error) {
    console.error('[OVERLAY-NEUTRALIZER] Start observer error:', error);
  }
}

/**
 * Stop the Overlay Neutralizer
 */
export function stopOverlayNeutralizer() {
  try {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    log('Overlay Neutralizer stopped');
  } catch (error) {
    log('Error stopping Overlay Neutralizer:', error);
  }
}
