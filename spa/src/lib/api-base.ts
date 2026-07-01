/**
 * API_BASE — the base URL for backend API calls.
 *
 * In development (Vite dev server), this is empty so calls use relative
 * paths like "/api/resolve-stream" which Vite proxies to localhost:3006.
 *
 * In production (GitHub Pages), this is set via VITE_API_BASE_URL env var
 * to point to the Render.com backend, e.g. "https://reelview-spa.onrender.com".
 */
const env = import.meta.env as Record<string, string | undefined>;
export const API_BASE: string = env.VITE_API_BASE_URL || '';

/**
 * Build a full API URL from a relative path.
 * @param path - e.g. "/api/resolve-stream"
 * @returns full URL, e.g. "https://reelview-spa.onrender.com/api/resolve-stream"
 */
export function apiUrl(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  return API_BASE + path;
}