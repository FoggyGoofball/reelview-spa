/**
 * Keep-alive ping for Render.com free tier.
 *
 * Render.com spins down free services after 15 minutes of inactivity,
 * causing 50+ second cold starts. This module sends a lightweight ping
 * to the backend health endpoint at random intervals between 7-14 minutes
 * to keep the server warm.
 *
 * The random interval makes the traffic pattern look organic rather than
 * a fixed-interval bot ping.
 */

import { apiUrl } from './api-base';

const MIN_INTERVAL_MS = 7 * 60 * 1000; // 7 minutes
const MAX_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

let pingTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * Get a random interval between 7 and 14 minutes.
 */
function getRandomInterval(): number {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

/**
 * Send a single keep-alive ping to the backend.
 * Uses a HEAD request to /health for minimal bandwidth.
 */
async function ping(): Promise<void> {
  try {
    await fetch(apiUrl('/health'), {
      method: 'HEAD',
      cache: 'no-cache',
    });
  } catch {
    // Server might be down or waking up — that's fine,
    // the ping itself may trigger the wake-up
  }
}

/**
 * Schedule the next ping at a random interval.
 */
function scheduleNextPing(): void {
  if (!isRunning) return;

  const interval = getRandomInterval();
  pingTimer = setTimeout(async () => {
    await ping();
    scheduleNextPing();
  }, interval);
}

/**
 * Start the keep-alive ping loop.
 * Safe to call multiple times — won't start duplicate loops.
 */
export function startKeepAlive(): void {
  if (isRunning) return;
  isRunning = true;

  // Send an initial ping immediately to warm up the server
  ping();

  // Then schedule recurring pings at random intervals
  scheduleNextPing();
}

/**
 * Stop the keep-alive ping loop.
 */
export function stopKeepAlive(): void {
  isRunning = false;
  if (pingTimer) {
    clearTimeout(pingTimer);
    pingTimer = null;
  }
}