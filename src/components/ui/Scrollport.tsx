'use client';

import { useLayoutEffect, useRef, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { bindScrollport, releaseScrollport } from '@/lib/scroll-surface';

/** Props for {@link Scrollport}. */
export interface ScrollportProps {
  /** Page or dialog body. */
  children: ReactNode;
  /** Extra classes. Never an overflow utility. */
  className?: string;
  /** Receives the scrollport element (AppShell stores it for scroll helpers). */
  scrollRef?: (node: HTMLDivElement | null) => void;
  /** Optional click handler (lightbox stops the backdrop close). */
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * The only layout scrollport. Overflow lives in `globals.css` on
 * `[data-scrollport]`. The newest mounted scrollport is the one that scrolls.
 * Every older one, including a sibling, is locked. Stray scrolling elements
 * are clipped by the scroll-surface sync.
 *
 * @param props - See {@link ScrollportProps}.
 * @returns The scrollport element.
 */
export function Scrollport({
  children,
  className,
  scrollRef,
  onClick,
}: ScrollportProps): ReactElement {
  const localRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    // The ref callback runs before this effect, so the node is mounted.
    const mine = localRef.current as HTMLDivElement;
    bindScrollport(mine);
    return () => {
      releaseScrollport(mine);
    };
  }, []);

  const extra = className === undefined || className === '' ? '' : ` ${className}`;

  return (
    <div
      ref={(node) => {
        localRef.current = node;
        if (scrollRef !== undefined) {
          scrollRef(node);
        }
      }}
      data-scrollport=""
      className={`min-h-0 min-w-0${extra}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
