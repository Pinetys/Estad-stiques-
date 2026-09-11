import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if the device is a tablet/desktop in landscape orientation.
 * Returns true when viewport width >= 768px and orientation is landscape (width > height).
 */
export function useIsLandscapeTablet(): boolean {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768 && window.innerWidth > window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkOrientation = () => {
      const isLand = window.innerWidth >= 768 && window.innerWidth > window.innerHeight;
      setIsLandscape(isLand);
    };

    // Initial check
    checkOrientation();

    // Listeners for window resize and orientation changes
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Media query listener
    const mql = window.matchMedia('(orientation: landscape) and (min-width: 768px)');
    const handleMql = (e: MediaQueryListEvent) => {
      setIsLandscape(e.matches && window.innerWidth >= 768);
    };

    try {
      mql.addEventListener('change', handleMql);
    } catch {
      mql.addListener(handleMql);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      try {
        mql.removeEventListener('change', handleMql);
      } catch {
        mql.removeListener(handleMql);
      }
    };
  }, []);

  return isLandscape;
}
