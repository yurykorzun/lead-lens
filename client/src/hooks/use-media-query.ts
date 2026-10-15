import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches now, updating when it changes (window resize, rotation) */
export function useMediaQuery(query: string): boolean {
  // Stable per query, so React doesn't re-subscribe the listener on every render
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
