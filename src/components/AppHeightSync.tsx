'use client';

import { useEffect } from 'react';

import { resolveAppHeight, resolveAppOffsetTop } from '@/lib/app-height';
import { revealInScrollport } from '@/lib/reveal-in-scrollport';

/** Input types that take no typed text, so focusing them opens no keyboard. */
const NON_TYPING_INPUTS = new Set([
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

/** Longest hold of the full height after leaving the writing composer, in ms. */
const HOLD_MS = 1000;

/** Whether focus on this node opens the on-screen keyboard. */
function isTypingField(node: EventTarget | null): boolean {
  return (
    node instanceof HTMLTextAreaElement ||
    (node instanceof HTMLInputElement && !NON_TYPING_INPUTS.has(node.type)) ||
    (node instanceof HTMLElement && node.isContentEditable)
  );
}

/** Whether the node is inside the forum home composer that has a writing mode. */
function inWritingComposer(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest('[data-writing-composer]') !== null;
}

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
 * One exception, for the forum home composer only (`[data-writing-composer]`,
 * touch devices): iOS reports the taller viewport only after the keyboard has
 * slid away. When the focus leaves that composer and no other text field
 * takes it, the height measured when the focus came into the composer from
 * no text field (the largest at this width), and offset 0, are written at
 * once and held until the viewport reports that height, another field takes
 * the focus, the orientation changes, or one second has passed. Every other
 * field keeps the plain behaviour.
 *
 * @returns void. Writes both custom properties, then reveals the focused field.
 */
export function useAppHeight(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    let focusFrame: number | null = null;
    // Full height before the keyboard opened for the writing composer, at this width.
    let restingHeight: number | null = null;
    let restingWidth = 0;
    let heldHeight: number | null = null;
    let holdTimer: number | null = null;

    const releaseHold = (): void => {
      heldHeight = null;
      if (holdTimer !== null) window.clearTimeout(holdTimer);
      holdTimer = null;
    };

    const writeViewport = (reveal = true): void => {
      const height = resolveAppHeight(window.innerHeight, viewport);
      if (height === null) return;
      let offsetTop = resolveAppOffsetTop(viewport);
      if (offsetTop === null) return;
      let shown = height;
      if (heldHeight !== null && height < heldHeight) {
        shown = heldHeight;
        offsetTop = 0;
      } else {
        releaseHold();
      }

      document.documentElement.style.setProperty('--app-height', `${shown}px`);
      document.documentElement.style.setProperty('--app-offset-top', `${offsetTop}px`);
      if (reveal) revealFocusedField();
    };

    const handleFocusIn = (event: FocusEvent): void => {
      releaseHold();
      if (inWritingComposer(event.target) && !isTypingField(event.relatedTarget)) {
        const height = resolveAppHeight(window.innerHeight, viewport);
        if (height !== null) {
          restingHeight =
            restingHeight !== null && restingWidth === window.innerWidth
              ? Math.max(restingHeight, height)
              : height;
          restingWidth = window.innerWidth;
        }
      }
      writeViewport(false);
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        focusFrame = null;
        revealFocusedField();
      });
    };
    const handleFocusOut = (event: FocusEvent): void => {
      if (
        restingHeight !== null &&
        restingWidth === window.innerWidth &&
        inWritingComposer(event.target) &&
        !inWritingComposer(event.relatedTarget) &&
        !isTypingField(event.relatedTarget)
      ) {
        releaseHold();
        heldHeight = restingHeight;
        holdTimer = window.setTimeout(() => {
          holdTimer = null;
          heldHeight = null;
          writeViewport(false);
        }, HOLD_MS);
      }
      writeViewport(false);
    };

    writeViewport(false);
    const handleWindowResize = (): void => {
      writeViewport(true);
    };
    const handleOrientationChange = (): void => {
      releaseHold();
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
      releaseHold();
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
