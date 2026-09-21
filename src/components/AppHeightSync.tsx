'use client';

import { useEffect, type ReactElement } from 'react';
import { resolveAppHeight } from '@/lib/app-height';

/**
 * After hydration: keep `--app-height` in sync with the layout canvas.
 * Uses `max(innerHeight, visualViewport.height + offsetTop)` so a short
 * visual viewport (stuck after keyboard, or keyboard `offsetTop` positive)
 * cannot leave a white gap below the rounded page frame. Skips updates
 * while `visualViewport.scale` is present and not ≈ 1.
 *
 * @returns void
 */
export function useAppHeight(): void {
  useEffect(() => {
    const setAppHeight = (): void => {
      const next = resolveAppHeight(window.innerHeight, window.visualViewport ?? undefined);
      if (next === null) {
        return;
      }
      document.documentElement.style.setProperty('--app-height', `${next}px`);
    };

    setAppHeight();

    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    document.addEventListener('focusin', setAppHeight);
    document.addEventListener('focusout', setAppHeight);

    const vv = window.visualViewport;
    if (vv !== null && vv !== undefined) {
      vv.addEventListener('resize', setAppHeight);
      vv.addEventListener('scroll', setAppHeight);
    }

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
      document.removeEventListener('focusin', setAppHeight);
      document.removeEventListener('focusout', setAppHeight);
      if (vv !== null && vv !== undefined) {
        vv.removeEventListener('resize', setAppHeight);
        vv.removeEventListener('scroll', setAppHeight);
      }
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
