/**
 * Stream Worker Registration and Management
 * 
 * Handles registration of the service worker that intercepts video stream requests
 * and fetches them directly from sources with proper headers.
 */

const WORKER_PATH = '/stream-worker.js';
const LOG_PREFIX = '[StreamWorkerManager]';

export interface WorkerStatus {
  registered: boolean;
  active: boolean;
  version?: string;
  error?: string;
}

let workerRegistration: ServiceWorkerRegistration | null = null;
let workerStatus: WorkerStatus = {
  registered: false,
  active: false
};

/**
 * Log messages with timestamp
 */
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `${LOG_PREFIX} [${timestamp}] [${level}] ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  const supported = 'serviceWorker' in navigator;
  log('INFO', `Service worker support: ${supported}`);
  return supported;
}

/**
 * Register the stream worker
 */
export async function registerStreamWorker(): Promise<WorkerStatus> {
  if (!isServiceWorkerSupported()) {
    log('ERROR', 'Service workers not supported in this browser');
    workerStatus = {
      registered: false,
      active: false,
      error: 'Service workers not supported'
    };
    return workerStatus;
  }

  try {
    log('INFO', 'Registering stream worker', { path: WORKER_PATH });
    
    // Check if already registered
    const existingRegistration = await navigator.serviceWorker.getRegistration(WORKER_PATH);
    if (existingRegistration) {
      log('INFO', 'Stream worker already registered');
      workerRegistration = existingRegistration;
      
      // Check if active
      if (existingRegistration.active) {
        workerStatus = {
          registered: true,
          active: true,
          version: await getWorkerVersion(existingRegistration.active)
        };
        log('INFO', 'Stream worker is active', { version: workerStatus.version });
        return workerStatus;
      }
    }

    // Register new worker
    workerRegistration = await navigator.serviceWorker.register(WORKER_PATH, {
      scope: '/'
    });

    log('INFO', 'Stream worker registered successfully');

    // Wait for activation
    if (workerRegistration.installing) {
      log('INFO', 'Stream worker installing...');
      
      workerRegistration.installing.addEventListener('statechange', (event) => {
        const worker = event.target as ServiceWorker;
        log('INFO', 'Stream worker state changed', { state: worker.state });
        
        if (worker.state === 'activated') {
          workerStatus.active = true;
          log('INFO', 'Stream worker activated');
        }
      });
    }

    if (workerRegistration.active) {
      workerStatus = {
        registered: true,
        active: true,
        version: await getWorkerVersion(workerRegistration.active)
      };
      log('INFO', 'Stream worker is active', { version: workerStatus.version });
    } else {
      workerStatus = {
        registered: true,
        active: false
      };
    }

    return workerStatus;
  } catch (error: any) {
    log('ERROR', 'Failed to register stream worker', {
      error: error.message,
      stack: error.stack
    });
    
    workerStatus = {
      registered: false,
      active: false,
      error: error.message
    };
    
    return workerStatus;
  }
}

/**
 * Get worker version via message
 */
async function getWorkerVersion(worker: ServiceWorker): Promise<string | undefined> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      log('DEBUG', 'Received version from worker', { version: event.data.version });
      resolve(event.data.version);
    };
    
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    
    // Timeout after 2 seconds
    setTimeout(() => {
      log('WARN', 'Version request timed out');
      resolve(undefined);
    }, 2000);
  });
}

/**
 * Get current worker status
 */
export function getWorkerStatus(): WorkerStatus {
  return { ...workerStatus };
}

/**
 * Unregister the stream worker
 */
export async function unregisterStreamWorker(): Promise<boolean> {
  if (!workerRegistration) {
    log('WARN', 'No worker registration found');
    return false;
  }

  try {
    log('INFO', 'Unregistering stream worker');
    const result = await workerRegistration.unregister();
    
    if (result) {
      log('INFO', 'Stream worker unregistered successfully');
      workerRegistration = null;
      workerStatus = {
        registered: false,
        active: false
      };
    } else {
      log('WARN', 'Failed to unregister stream worker');
    }
    
    return result;
  } catch (error: any) {
    log('ERROR', 'Error unregistering stream worker', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

/**
 * Add a header profile for a specific domain
 */
export async function addHeaderProfile(
  domain: string,
  headers: Record<string, string>
): Promise<boolean> {
  if (!workerRegistration?.active) {
    log('ERROR', 'No active worker to send header profile to');
    return false;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      log('INFO', 'Header profile added', { domain, success: event.data.success });
      resolve(event.data.success);
    };
    
    workerRegistration!.active!.postMessage(
      {
        type: 'ADD_HEADER_PROFILE',
        domain,
        headers
      },
      [channel.port2]
    );
    
    // Timeout after 2 seconds
    setTimeout(() => {
      log('WARN', 'Add header profile request timed out');
      resolve(false);
    }, 2000);
  });
}

/**
 * Convert a source URL to a stream worker URL
 */
export function toStreamWorkerUrl(sourceUrl: string): string {
  const encodedUrl = encodeURIComponent(sourceUrl);
  const workerUrl = `/stream/${encodedUrl}`;
  
  log('DEBUG', 'Converted to stream worker URL', {
    sourceUrl,
    workerUrl
  });
  
  return workerUrl;
}

/**
 * Check if a URL should use the stream worker
 */
export function shouldUseStreamWorker(url: string): boolean {
  // Use worker for known video sources
  const videoSourcePatterns = [
    'empoweredfreelancerhub.site',
    'm3u8',
    '.mp4',
    '.webm'
  ];
  
  const shouldUse = videoSourcePatterns.some(pattern => 
    url.toLowerCase().includes(pattern)
  );
  
  log('DEBUG', 'Should use stream worker', {
    url,
    shouldUse
  });
  
  return shouldUse;
}

log('INFO', 'Stream worker manager loaded');