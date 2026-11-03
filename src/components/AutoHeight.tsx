'use client';

import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  MOTION_FOLD_MS,
  afterTransition,
  announceSettle,
  prefersReducedMotion,
} from '@/lib/motion';

/** Props for {@link AutoHeight}. */
export interface AutoHeightProps {
  children: ReactNode;
  /** Classes for the inner box that holds the content. */
  className?: string | undefined;
}

/**
 * Glides its height whenever the content's height changes (one view swapped for another, a line
 * added), so the content below follows smoothly. The height is written on the box from a
 * `ResizeObserver`, before the frame is painted. The box clips only while the height moves, so
 * focus rings and pop-up lists stay visible at rest. While a box inside it is still gliding, it
 * follows that glide at once instead of gliding behind it. Without `ResizeObserver` the box keeps
 * its natural height.
 *
 * @param props - The content and optional inner classes.
 * @returns The gliding box.
 */
export function AutoHeight({ children, className }: AutoHeightProps): ReactElement {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const box = outer.current as HTMLDivElement;
    const content = inner.current as HTMLDivElement;
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    let stopGlide = (): void => undefined;
    let prev: number | null = null;
    const observer = new ResizeObserver(() => {
      // Fractional, so a box at rest is exactly as tall as its content (no rounding shift).
      const next = content.getBoundingClientRect().height;
      // A box inside that is still gliding changes this content frame by frame: follow it at
      // once (`data-follow` turns the transition off) instead of gliding a second time behind it.
      const follow = content.querySelector('[data-auto-height][data-gliding]') !== null;
      box.toggleAttribute('data-follow', follow);
      if (prev !== null && prev !== next && !follow && !prefersReducedMotion()) {
        setMoving(true);
        box.toggleAttribute('data-gliding', true);
        stopGlide();
        stopGlide = afterTransition(box, 'height', MOTION_FOLD_MS, () => {
          announceSettle(box);
          setMoving(false);
          box.toggleAttribute('data-gliding', false);
        });
      }
      prev = next;
      box.style.height = `${String(next)}px`;
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      stopGlide();
      box.style.height = '';
    };
  }, []);

  return (
    <div
      ref={outer}
      data-auto-height=""
      className={`w-full min-w-0 transition-[height] duration-280 ease-glide motion-reduce:transition-none data-[follow]:transition-none${
        moving ? ' overflow-hidden' : ''
      }`}
    >
      <div ref={inner} className={className === undefined ? 'flow-root' : `flow-root ${className}`}>
        {children}
      </div>
    </div>
  );
}
