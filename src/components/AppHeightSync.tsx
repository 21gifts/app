'use client';

import { useEffect } from 'react';

import { resolveAppHeight, resolveAppOffsetTop } from '@/lib/app-height';
import { revealInScrollport } from '@/lib/reveal-in-scrollport';

function revealFocusedField(): void {
  const active = document.activeElement;
  if (!(
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement
  )) {
    return;
  }
  const scroller = active.closest('[data-scrollport][data-scroll-active]');
  if (!(scroller instanceof HTMLElement)) return;
  revealInScrollport(scroller, active);
}

/**
 * Keeps `--app-height` equal to `visualViewport.height` (else `innerHeight`).
 * `--app-offset-top` positions `body`. The offset is never added into the height.
 * Pinch-zoom (`|scale - 1| > 0.01`) skips both writes. After each write from a
 * viewport resize or scroll, and on focus via `requestAnimationFrame`, the
 * focused input, textarea, or select is revealed inside the active scrollport.
 *
 * @returns void. Writes both custom properties, then reveals the focused field.
 */
export function useAppHeight(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    let focusFrame: number | null = null;

    const writeViewport = (reveal = true): void => {
      const height = resolveAppHeight(window.innerHeight, viewport);
      if (height === null) return;
      const offsetTop = resolveAppOffsetTop(viewport);
      if (offsetTop === null) return;

      document.documentElement.style.setProperty('--app-height', `${height}px`);
      document.documentElement.style.setProperty('--app-offset-top', `${offsetTop}px`);
      if (reveal) revealFocusedField();
    };

    const handleFocusIn = (): void => {
      writeViewport(false);
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null;
        revealFocusedField();
      });
    };
    const handleFocusOut = (): void => writeViewport(false);

    writeViewport(false);
    const handleWindowResize = (): void => {
      writeViewport(true);
    };
    const handleOrientationChange = (): void => {
      writeViewport(true);
    };
    const handleViewportResize = (): void => {
      writeViewport(true);
    };
    const handleViewportScroll = (): void => {
      writeViewport(true);
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    viewport?.addEventListener('resize', handleViewportResize);
    viewport?.addEventListener('scroll', handleViewportScroll);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      viewport?.removeEventListener('resize', handleViewportResize);
      viewport?.removeEventListener('scroll', handleViewportScroll);
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    };
  }, []);
}

/**
 * Client mount that keeps `--app-height` at `visualViewport.height` and
 * `--app-offset-top` as the body offset. The offset is never added into the height.
 *
 * @returns `null` (side-effect only).
 */
export function AppHeightSync(): null {
  useAppHeight();
  return null;
}
