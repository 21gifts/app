'use client';

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AutoHeight } from '@/components/AutoHeight';
import { MOTION_SWAP_FADE_MS, afterTransition, prefersReducedMotion } from '@/lib/motion';

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
  const fading = useRef<HTMLDivElement>(null);
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
    return afterTransition(fading.current as HTMLDivElement, 'opacity', MOTION_SWAP_FADE_MS, () => {
      setCurrentKey(viewKey);
      setVisible(true);
    });
  }, [leaving, instant, viewKey]);

  const fade = visible || instant ? 'opacity-100' : 'opacity-0';
  return (
    <AutoHeight>
      <div
        ref={fading}
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
