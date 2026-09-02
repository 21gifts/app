'use client';

import { useEffect, type ReactElement } from 'react';

/**
 * After hydration: keep `--app-height` in sync with the visible viewport.
 *
 * @returns void
 */
export function useAppHeight(): void {
  useEffect(() => {
    const setAppHeight = (): void => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
    };

    setAppHeight();

    const vv = window.visualViewport;
    if (vv !== null && vv !== undefined) {
      vv.addEventListener('resize', setAppHeight);
      vv.addEventListener('scroll', setAppHeight);
      window.addEventListener('orientationchange', setAppHeight);
      return () => {
        vv.removeEventListener('resize', setAppHeight);
        vv.removeEventListener('scroll', setAppHeight);
        window.removeEventListener('orientationchange', setAppHeight);
      };
    }

    window.addEventListener('resize', setAppHeight);
    return () => {
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);
}

/**
 * Client mount that keeps `--app-height` synced after hydration.
 *
 * @returns `null` (side-effect only).
 */
export function AppHeightSync(): ReactElement | null {
  useAppHeight();
  return null;
}
