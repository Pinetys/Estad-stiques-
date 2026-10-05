/**
 * URL and Spectator Link Helpers
 * 
 * Safely computes the full base URL taking into account subpaths
 * (such as GitHub Pages https://<user>.github.io/<repo>/, subdirectories, or dev proxies)
 * so that QR codes and shared links never produce 404 errors.
 */

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  let origin = window.location.origin;

  // 1. If running in AI Studio development origin ('ais-dev-*.run.app'),
  // spectators cannot open 'ais-dev' links on external devices because it requires Google account developer auth.
  // The public shared app URL that ANY phone/spectator can access is 'ais-pre-*.run.app'.
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  // 2. If hosted on github.io, ensure repository root is strictly preserved
  if (window.location.hostname.endsWith('github.io')) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const repoName = segments[0] || '';
    if (repoName) {
      return `${origin}/${repoName}/`;
    }
  }

  // 3. Clean pathname: remove trailing files (e.g. index.html or other assets)
  let pathname = window.location.pathname.replace(/\/[^/]*\.[a-zA-Z0-9]+$/i, '');
  if (!pathname.endsWith('/')) {
    pathname = `${pathname}/`;
  }
  return `${origin}${pathname}`;
}

export function buildSpectatorUrl(code: string, matchId: string, customBaseUrl?: string): string {
  const base = customBaseUrl || getAppBaseUrl();
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
