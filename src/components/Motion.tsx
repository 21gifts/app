'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

/** Length of a reveal, a fold, and a height glide, in ms (`duration-280` below). */
export const EASE_MS = 280;

/** Length of the fade out and of the fade in of a {@link Swap}, in ms (`duration-180` below). */
export const SWAP_FADE_MS = 180;

/** Extra wait after a CSS move before the box stops clipping or unmounts, in ms. */
const SETTLE_MS = 40;

/**
 * Time from the start of an opening, a fold, or a height glide until the box has settled, in ms:
 * it stops clipping, or a folded {@link Collapse} unmounts.
 */
export const FOLD_MS = EASE_MS + SETTLE_MS;

/**
 * Whether the visitor asked for reduced motion. The global CSS rule already makes every
 * transition instant; the timers here read this so they do not wait for a move that never runs.
 *
 * @returns True when `prefers-reduced-motion: reduce` matches.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Props for {@link Collapse}. */
export interface CollapseProps {
  /** True shows the content; false folds it away and unmounts it once folded. */
  show: boolean;
  children: ReactNode;
  /** Classes for the inner box (spacing that belongs to the content). */
  className?: string | undefined;
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
export function Collapse({ show, children, className }: CollapseProps): ReactElement | null {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show);
  const [settled, setSettled] = useState(show);
  const last = useRef<ReactNode>(children);
  const shown = useRef(show);
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
    if (show) {
      setMounted(true);
      if (reduced) {
        setOpen(true);
        setSettled(true);
        return;
      }
      setSettled(false);
      // Two frames, so the closed box is laid out before it opens and the browser eases the change.
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setOpen(true));
      });
      const done = window.setTimeout(() => setSettled(true), FOLD_MS);
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
        window.clearTimeout(done);
      };
    }
    setSettled(false);
    setOpen(false);
    if (reduced) {
      setMounted(false);
      return;
    }
    const gone = window.setTimeout(() => setMounted(false), FOLD_MS);
    return () => window.clearTimeout(gone);
  }, [show]);

  // Shown content mounts in the same commit as `show`, so code that looks for it right after finds it.
  if (!show && !mounted) {
    return null;
  }
  return (
    <div
      data-collapse={open ? (settled ? 'open' : 'opening') : 'closed'}
      inert={!show}
      className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,opacity] duration-280 ease-glide motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className={open && settled ? 'min-h-0' : 'min-h-0 overflow-hidden'}>
        <AutoHeight className={className}>{show ? children : last.current}</AutoHeight>
      </div>
    </div>
  );
}

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
    let timer = 0;
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
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          setMoving(false);
          box.toggleAttribute('data-gliding', false);
        }, FOLD_MS);
      }
      prev = next;
      box.style.height = `${String(next)}px`;
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
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

/** Props for {@link Swap}. */
export interface SwapProps {
  /** Names the view being shown; a new key fades the old view out before the new one fades in. */
  viewKey: string;
  children: ReactNode;
  /** Classes for the box that holds the view (e.g. the flex column the view's parts sit in). */
  className?: string | undefined;
}

/**
 * Replaces one view with another in steps instead of at once: the old view fades out where it
 * is, then the box glides to the new height while the new view fades in. Changes inside the same
 * view render right away. The leaving view is inert. With reduced motion the new view shows at once.
 *
 * @param props - The view key, the view, and optional classes for its box.
 * @returns The swapping box.
 */
export function Swap({ viewKey, children, className }: SwapProps): ReactElement {
  const [currentKey, setCurrentKey] = useState(viewKey);
  const [visible, setVisible] = useState(true);
  const held = useRef<ReactNode>(children);
  const leaving = viewKey !== currentKey;
  const instant = leaving && prefersReducedMotion();
  if (!leaving || instant) {
    held.current = children;
  }

  useEffect(() => {
    if (!leaving) {
      // The key came back before the old view left: show it again.
      setVisible(true);
      return;
    }
    if (instant) {
      setCurrentKey(viewKey);
      return;
    }
    setVisible(false);
    const timer = window.setTimeout(() => {
      setCurrentKey(viewKey);
      setVisible(true);
    }, SWAP_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, instant, viewKey]);

  const fade = visible || instant ? 'opacity-100' : 'opacity-0';
  return (
    <AutoHeight>
      <div
        data-swap={currentKey}
        inert={!visible && !instant}
        className={`transition-opacity duration-180 ease-glide motion-reduce:transition-none ${fade}${
          className === undefined ? '' : ` ${className}`
        }`}
      >
        {held.current}
      </div>
    </AutoHeight>
  );
}
