'use client';

import { useLayoutEffect, type ReactElement } from 'react';
import { syncScrollSurfaces } from '@/lib/scroll-surface';

/**
 * Watches the document and keeps a single scroll surface. A stray scrolling
 * overflow, including one set from script, is forced to clip. Textareas
 * grow instead of scrolling inside the page.
 *
 * @returns `null` (side-effect only).
 */
export function ScrollSurfaceGuard(): ReactElement | null {
  useLayoutEffect(() => {
    const observe = (): void => {
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    };
    const observer = new MutationObserver(() => {
      observer.disconnect();
      syncScrollSurfaces();
      observe();
    });
    syncScrollSurfaces();
    observe();
    const onInput = (event: Event): void => {
      if (event.target instanceof HTMLTextAreaElement) {
        syncScrollSurfaces();
      }
    };
    document.addEventListener('input', onInput);
    return () => {
      observer.disconnect();
      document.removeEventListener('input', onInput);
    };
  }, []);
  return null;
}
