/**
 * URL and Spectator Link Helpers
 * 
 * Safely computes the full base URL taking into account subpaths
 * (such as GitHub Pages https://<user>.github.io/<repo>/, subdirectories, or dev proxies)
 * so that QR codes and shared links never produce 404 errors.
 */

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  // Strip index.html from path
  let pathname = window.location.pathname.replace(/\/index\.html$/i, '');
  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`;
  }
  return `${origin}${pathname}`;
}

export function buildSpectatorUrl(code: string, matchId: string): string {
  const base = getAppBaseUrl();
  const params = new URLSearchParams();
  if (code) {
    params.set('pair', code.trim().toUpperCase());
  }
  if (matchId) {
    params.set('match', matchId.trim());
  }
  params.set('mode', 'spectator');
  return `${base}?${params.toString()}`;
}
