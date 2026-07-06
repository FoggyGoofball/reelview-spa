/**
 * throttle.ts
 *
 * Per-domain outbound request throttling - a token-bucket queue that prevents
 * upstream providers from seeing bursts that could get us blocked.
 *
 * Rules per domain:
 *   - Max 2 concurrent requests
 *   - Minimum 2-second gap between requests to the same domain
 *
 * Usage:
 *   import { throttledFetch } from '../lib/throttle.js';
 *   const res = await throttledFetch('https://api.tulnex.com/...', options);
 */

interface DomainState {
  active: number;
  lastRequest: number;
  queue: Array<() => void>;
}

const MAX_CONCURRENT = 2;
const MIN_GAP_MS = 2000;

const domains = new Map<string, DomainState>();

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return '__unknown__';
  }
}

async function acquireSlot(domain: string): Promise<void> {
  let state = domains.get(domain);
  if (!state) {
    state = { active: 0, lastRequest: 0, queue: [] };
    domains.set(domain, state);
  }

  if (state.active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => {
      state!.queue.push(resolve);
    });
    return acquireSlot(domain);
  }

  const now = Date.now();
  const elapsed = now - state.lastRequest;
  if (elapsed < MIN_GAP_MS) {
    const wait = MIN_GAP_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  state.active++;
}

function releaseSlot(domain: string): void {
  const state = domains.get(domain);
  if (!state) return;
  state.active--;
  state.lastRequest = Date.now();
  const next = state.queue.shift();
  if (next) {
    setImmediate(next);
  }
}

export async function throttledFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const domain = extractDomain(url);
  await acquireSlot(domain);
  try {
    return await fetch(url, options);
  } finally {
    releaseSlot(domain);
  }
}

export function resetThrottle(): void {
  domains.clear();
}

export function getThrottleStats(): Record<string, { active: number; queued: number; lastRequest: string }> {
  const stats: Record<string, any> = {};
  for (const [domain, state] of domains) {
    stats[domain] = {
      active: state.active,
      queued: state.queue.length,
      lastRequest: state.lastRequest ? new Date(state.lastRequest).toISOString() : 'never',
    };
  }
  return stats;
}
