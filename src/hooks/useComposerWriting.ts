'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useState,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { AppShellContext } from '@/components/AppShell';

/** Duration of the fold in and out of writing mode, in ms. */
const FOLD_MS = 250;

/** Gap kept between the header row and the composer once the fold settled, in px. */
const SETTLE_GAP = 8;

/** Writing mode of one composer, from {@link useComposerWriting}. */
export interface ComposerWriting {
  /** True on a touch device (`(pointer: coarse)`) while the hook is enabled. */
  touch: boolean;
  /** True while the composer's text field has the focus on a touch device. */
  writing: boolean;
  /** Focus handler for the whole composer: focus on its text field turns writing mode on. */
  onComposerFocus: (event: FocusEvent<HTMLElement>) => void;
  /** Blur handler for the whole composer: turns writing mode off once the focus left it. */
  onComposerBlur: (event: FocusEvent<HTMLElement>) => void;
  /** Pointer-down handler for the composer: a button press keeps the text field focused. */
  onComposerPointerDown: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Writing mode of the forum home composer on a touch device. Off when
 * `enabled` is false or the primary pointer is fine (desktop): then every
 * handler does nothing and the page is unchanged.
 *
 * On a touch device it is on while the composer's text field has the focus.
 * It turns on in the composer's focus handler when its text field takes the
 * focus, before the keyboard moves the
 * viewport, and off when the focus leaves the composer (or `active` turns
 * false, e.g. while a post is sending and the field is disabled): one switch
 * each way, not driven by the keyboard height. It tells the {@link AppShell}
 * (`ready` while mounted, `on` while writing), and about 250 ms after it
 * turned on (at once with reduced motion) it scrolls the page so the
 * composer sits just under the header row. While writing, a pointer-down on
 * one of the composer's own buttons (not a suggestion in a listbox) is
 * prevented, so the field keeps the focus and nothing moves under the finger;
 * the click still runs.
 *
 * @param enabled - Whether this composer has a writing mode (the forum home only).
 * @param active - False while the field cannot take text; ends writing mode.
 * @param composerRef - The composer element (the form), scrolled into place.
 * @returns Whether writing mode can run and is on, and the composer's handlers.
 */
export function useComposerWriting(
  enabled: boolean,
  active: boolean,
  composerRef: RefObject<HTMLElement | null>,
): ComposerWriting {
  const setShellWriting = useContext(AppShellContext)?.setWriting;
  const [coarse, setCoarse] = useState(false);
  const [focused, setFocused] = useState(false);
  const touch = enabled && coarse;
  const writing = touch && active && focused;

  useEffect(() => {
    if (enabled) {
      setCoarse(window.matchMedia('(pointer: coarse)').matches);
    }
  }, [enabled]);

  useEffect(() => {
    if (!active) {
      setFocused(false);
    }
  }, [active]);

  useEffect(() => {
    if (!touch || setShellWriting === undefined) {
      return;
    }
    setShellWriting(writing ? 'on' : 'ready');
    return () => {
      setShellWriting('off');
    };
  }, [touch, writing, setShellWriting]);

  useEffect(() => {
    if (!writing) {
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        const composer = composerRef.current;
        const port = composer?.closest('[data-scrollport]');
        if (composer === null || composer === undefined || !(port instanceof HTMLElement)) {
          return;
        }
        const offset =
          composer.getBoundingClientRect().top - port.getBoundingClientRect().top - SETTLE_GAP;
        port.scrollTo({ top: port.scrollTop + offset, behavior: reduced ? 'auto' : 'smooth' });
      },
      reduced ? 0 : FOLD_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [writing, composerRef]);

  const onComposerFocus = useCallback(
    (event: FocusEvent<HTMLElement>): void => {
      if (
        touch &&
        event.target instanceof HTMLTextAreaElement &&
        event.currentTarget.contains(event.target)
      ) {
        setFocused(true);
      }
    },
    [touch],
  );

  const onComposerBlur = useCallback((event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setFocused(false);
  }, []);

  const onComposerPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>): void => {
      if (!writing || !(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest('button');
      if (
        button === null ||
        !event.currentTarget.contains(button) ||
        button.closest('[role="listbox"]') !== null
      ) {
        return;
      }
      event.preventDefault();
    },
    [writing],
  );

  return { touch, writing, onComposerFocus, onComposerBlur, onComposerPointerDown };
}
