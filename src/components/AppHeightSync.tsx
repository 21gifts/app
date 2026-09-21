'use client';

import { useEffect, type ReactElement } from 'react';
import { resolveAppHeight } from '@/lib/app-height';

const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

function isTextFieldFocused(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(target.type);
  }
  if (target instanceof HTMLElement) {
    return target.isContentEditable;
  }
  return false;
}

/**
 * After hydration: keep `--app-height` in sync with the layout canvas.
 * Unfocused: `max(visualViewport.height, innerHeight)`. Focused text field:
 * `visualViewport.height` (keyboard). Skips updates while
 * `visualViewport.scale` is present and not ≈ 1.
 *
 * @returns void
 */
export function useAppHeight(): void {
  useEffect(() => {
    const setAppHeight = (): void => {
      const next = resolveAppHeight(
        window.innerHeight,
        window.visualViewport ?? undefined,
        isTextFieldFocused(document.activeElement),
      );
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
