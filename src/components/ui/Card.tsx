'use client';

import { useContext, useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { AppShellContext } from '@/components/AppShell';

/** Props for {@link Card}. */
export interface CardProps {
  /** Card body. */
  children: ReactNode;
  /** Extra classes on the section. */
  className?: string;
  /** Max width utility; default `max-w-sm`. */
  maxWidth?: 'sm' | 'md' | 'xl';
  /**
   * When true (default), the first Card under `AppShell` `fill` + `align="center"`
   * hosts page chrome as its top row. `false` never claims (overlays, public
   * notes, secondary cards).
   */
  chrome?: boolean;
}

const MAX_WIDTH: Record<NonNullable<CardProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  xl: 'max-w-xl',
};

/**
 * Primary app content panel using semantic card tokens. Under `AppShell`
 * `fill` + `align="center"`, the first Card with `chrome` not false hosts
 * `topLeft` / `topRight` inside the `rounded-3xl` border.
 *
 * @param props - See {@link CardProps}.
 * @returns The card element.
 */
export function Card({
  children,
  className,
  maxWidth = 'sm',
  chrome = true,
}: CardProps): ReactElement {
  const ctx = useContext(AppShellContext);
  const claimCardChrome = ctx === null ? undefined : ctx.claimCardChrome;
  const [holdsChrome, setHoldsChrome] = useState(false);
  const extra = className === undefined || className === '' ? '' : ` ${className}`;

  useLayoutEffect(() => {
    if (chrome === false || claimCardChrome === undefined) {
      setHoldsChrome(false);
      return;
    }
    const unclaim = claimCardChrome();
    setHoldsChrome(unclaim.claimed);
    return () => {
      unclaim();
      setHoldsChrome(false);
    };
  }, [chrome, claimCardChrome]);

  const showInCardHeader = holdsChrome && ctx !== null && ctx.chromeInCard;
  const showPageTopLeft =
    showInCardHeader &&
    ctx !== null &&
    !ctx.hasTopLeftPortal &&
    ctx.topLeft !== undefined &&
    ctx.topLeft !== null;

  return (
    <section
      className={`flex w-full ${MAX_WIDTH[maxWidth]} flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm${extra}`}
    >
      {ctx !== null && showInCardHeader ? (
        <div className="flex w-full items-center justify-between gap-2">
          <div ref={ctx.setTopLeftEl} className="flex min-w-0 items-center gap-2 empty:hidden">
            {showPageTopLeft ? ctx.topLeft : null}
          </div>
          {ctx.topRight ? (
            <div className="flex shrink-0 items-center gap-2">{ctx.topRight}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
