'use client';

import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AutoHeight } from '@/components/AutoHeight';
import {
  MOTION_FOLD_MS,
  afterTransition,
  announceSettle,
  prefersReducedMotion,
} from '@/lib/motion';

/** Props for {@link Collapse}. */
export interface CollapseProps {
  /** True shows the content; false folds it away and unmounts it once folded. */
  show: boolean;
  children: ReactNode;
  /** Classes for the inner box (spacing that belongs to the content). */
  className?: string | undefined;
  /**
   * True closes at once instead of folding, for content whose place another one takes in the same
   * step (a second copy of it must not stay mounted while the first folds). Opening still eases.
   */
  instant?: boolean | undefined;
}

/**
 * Opens and closes its content by easing the height and the opacity, so the content around it
 * moves smoothly instead of jumping. On close the last shown content stays in place, inert, until
 * it has folded away. Content mounts as soon as `show` turns true (closed, then easing open), and
 * content shown on the first render does not animate. While open, a change in
 * the content's height glides too ({@link AutoHeight}). The box clips only while it moves, so
 * focus rings and pop-up lists stay visible at rest, and it never grows wider than its parent.
 *
 * @param props - `show`, the content, and optional inner classes.
 * @returns The folding box (`data-collapse` `closed`, `opening`, or `open` once settled), or
 * `null` while closed.
 */
export function Collapse({
  show,
  children,
  className,
  instant = false,
}: CollapseProps): ReactElement | null {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show);
  const [settled, setSettled] = useState(show);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<ReactNode>(children);
  const shown = useRef(show);
  const closeAtOnce = useRef(instant);
  closeAtOnce.current = instant;
  if (show) {
    last.current = children;
  }

  // Before paint, so a reduced-motion change never shows an in-between frame.
  useLayoutEffect(() => {
    // Only a change moves: the first render shows its state as it is.
    if (shown.current === show) {
      return;
    }
    shown.current = show;
    const reduced = prefersReducedMotion();
    // The box is in the DOM: `show` mounts it in the same commit, and a fold keeps it.
    const el = box.current as HTMLDivElement;
    if (show) {
      setMounted(true);
      setOpen(true);
      if (reduced) {
        setSettled(true);
        return;
      }
      setSettled(false);
      // Lay the closed box out first, so the browser eases from closed to open.
      void el.offsetHeight;
      return afterTransition(el, 'grid-template-rows', MOTION_FOLD_MS, () => {
        announceSettle(el);
        // Open in the same task as the event: React renders the settled state later, and a size
        // observer that runs in between must not read the box as still opening.
        el.setAttribute('data-collapse', 'open');
        setSettled(true);
      });
    }
    setSettled(false);
    setOpen(false);
    if (reduced || closeAtOnce.current) {
      setMounted(false);
      return;
    }
    return afterTransition(el, 'grid-template-rows', MOTION_FOLD_MS, () => setMounted(false));
  }, [show]);

  // Another one took this place while it was folding: drop the folding copy now.
  useLayoutEffect(() => {
    if (!show && instant) {
      setMounted(false);
    }
  }, [show, instant]);

  // With reduced motion a change shows its end in the same commit (code that measures right after,
  // a reveal in the scrollport, sees the final layout); the effect above then settles the state.
  const atOnce = show !== shown.current && prefersReducedMotion();
  const isOpen = open || (show && atOnce);
  const isSettled = settled || (show && atOnce);

  // Shown content mounts in the same commit as `show`, so code that looks for it right after finds
  // it; an instant close removes it in the same commit too.
  if (!show && (!mounted || instant || atOnce)) {
    return null;
  }
  return (
    <div
      ref={box}
      data-collapse={isOpen ? (isSettled ? 'open' : 'opening') : 'closed'}
      inert={!show}
      className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] duration-280 ease-glide motion-reduce:transition-none ${
        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className={isOpen && isSettled ? 'min-h-0' : 'min-h-0 overflow-hidden'}>
        <AutoHeight className={className}>{show ? children : last.current}</AutoHeight>
      </div>
    </div>
  );
}
