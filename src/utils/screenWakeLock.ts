/**
 * Screen Wake Lock Manager for Basketball Court Stat-Keeping
 * Prevents mobile devices from dimming, sleeping, or locking the screen
 * while tracking games, recording actions, or in Court Mode.
 */

import { useEffect, useState, useCallback } from 'react';

// Minimal blank 1x1 MP4 video base64 for fallback in webviews / older browsers
const TINY_SILENT_VIDEO_BASE64 =
  'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQAAADFtb292AAAAbG12aGQAAAAA7wAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAABdHJhawAAAFx0a2hkAAAAB+/AAAAAAAEAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAA';

type WakeLockSentinelType = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

let sentinel: WakeLockSentinelType | null = null;
let fallbackVideo: HTMLVideoElement | null = null;
let isRequestedGlobally = false;
const listeners = new Set<(active: boolean) => void>();

function notifyListeners(active: boolean) {
  listeners.forEach(listener => {
    try {
      listener(active);
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Checks if the standard Screen Wake Lock API is supported in the current environment
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator && Boolean(navigator.wakeLock);
}

/**
 * Returns whether the screen wake lock is currently active
 */
export function isWakeLockActive(): boolean {
  if (sentinel && !sentinel.released) return true;
  if (fallbackVideo && !fallbackVideo.paused) return true;
  return false;
}

/**
 * Start invisible video loop fallback for browsers/webviews without WakeLock API
 */
function startFallbackVideo(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    if (!fallbackVideo) {
      fallbackVideo = document.createElement('video');
      fallbackVideo.setAttribute('playsinline', '');
      fallbackVideo.setAttribute('webkit-playsinline', '');
      fallbackVideo.setAttribute('muted', '');
      fallbackVideo.muted = true;
      fallbackVideo.loop = true;
      fallbackVideo.style.position = 'fixed';
      fallbackVideo.style.bottom = '0';
      fallbackVideo.style.right = '0';
      fallbackVideo.style.width = '1px';
      fallbackVideo.style.height = '1px';
      fallbackVideo.style.opacity = '0.001';
      fallbackVideo.style.pointerEvents = 'none';
      fallbackVideo.style.zIndex = '-9999';
      fallbackVideo.src = TINY_SILENT_VIDEO_BASE64;
      document.body.appendChild(fallbackVideo);
    }
    const playPromise = fallbackVideo.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          notifyListeners(true);
        })
        .catch(() => {
          // Will retry on next user interaction
        });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop the invisible video fallback
 */
function stopFallbackVideo() {
  if (fallbackVideo) {
    try {
      fallbackVideo.pause();
      fallbackVideo.src = '';
      if (fallbackVideo.parentNode) {
        fallbackVideo.parentNode.removeChild(fallbackVideo);
      }
    } catch {
      // ignore
    }
    fallbackVideo = null;
  }
}

/**
 * Requests the mobile device screen to stay awake
 */
export async function acquireWakeLock(): Promise<boolean> {
  isRequestedGlobally = true;

  // 1. Try standard Screen Wake Lock API
  if (isWakeLockSupported()) {
    try {
      if (sentinel && !sentinel.released) {
        notifyListeners(true);
        return true;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lock = await (navigator as any).wakeLock.request('screen');
      sentinel = lock;

      sentinel?.addEventListener('release', () => {
        sentinel = null;
        notifyListeners(isWakeLockActive());
      });

      notifyListeners(true);
      return true;
    } catch (err) {
      console.warn('Navigator Wake Lock request rejected, falling back to video loop:', err);
      // Fall through to video fallback
    }
  }

  // 2. Fallback to video loop
  const videoStarted = startFallbackVideo();
  return videoStarted;
}

/**
 * Releases the wake lock, allowing the device to sleep naturally
 */
export async function releaseWakeLock(): Promise<void> {
  isRequestedGlobally = false;

  if (sentinel) {
    try {
      await sentinel.release();
    } catch {
      // ignore
    }
    sentinel = null;
  }

  stopFallbackVideo();
  notifyListeners(false);
}

// Automatically re-request wake lock when user switches back to the tab/app
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRequestedGlobally) {
      acquireWakeLock().catch(() => {});
    }
  });

  // Re-attempt on first interaction if initial request required user gesture
  const onFirstInteraction = () => {
    if (isRequestedGlobally && !isWakeLockActive()) {
      acquireWakeLock().catch(() => {});
    }
  };

  window.addEventListener('pointerdown', onFirstInteraction, { passive: true });
  window.addEventListener('touchstart', onFirstInteraction, { passive: true });
}

/**
 * React Hook to manage Screen Wake Lock during court recording sessions
 */
export function useScreenWakeLock(enabled = true) {
  const [isActive, setIsActive] = useState<boolean>(() => isWakeLockActive());
  const supported = isWakeLockSupported();

  useEffect(() => {
    const handleStateChange = (active: boolean) => {
      setIsActive(active);
    };

    listeners.add(handleStateChange);

    if (enabled) {
      acquireWakeLock().catch(() => {});
    } else {
      releaseWakeLock().catch(() => {});
    }

    return () => {
      listeners.delete(handleStateChange);
    };
  }, [enabled]);

  const toggle = useCallback(() => {
    if (isActive) {
      releaseWakeLock().catch(() => {});
    } else {
      acquireWakeLock().catch(() => {});
    }
  }, [isActive]);

  return {
    isActive,
    isSupported: supported,
    toggle,
    request: acquireWakeLock,
    release: releaseWakeLock,
  };
}
