'use client';

import { useLayoutEffect, useRef, type MouseEvent, type ReactElement, type ReactNode } from 'react';

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
 * `[data-scrollport]`. While mounted, ancestor scrollports are locked so two
 * surfaces cannot scroll at once.
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
    const mine = localRef.current;
    if (mine === null) {
      return;
    }
    const locked: HTMLElement[] = [];
    let parent = mine.parentElement;
    while (parent !== null) {
      if (parent.hasAttribute('data-scrollport')) {
        parent.setAttribute('data-scroll-locked', '');
        locked.push(parent);
      }
      parent = parent.parentElement;
    }
    return () => {
      for (const node of locked) {
        node.removeAttribute('data-scroll-locked');
      }
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
