import type { ReactElement, ReactNode } from 'react';

/** Props for {@link Card}. */
export interface CardProps {
  /** Card body. */
  children: ReactNode;
  /** Extra classes on the section. */
  className?: string;
  /** Max width utility; default `max-w-sm`. */
  maxWidth?: 'sm' | 'md' | 'xl';
  /**
   * Visual panel. Default true. `false` is width + flex + gap column only
   * (page body inside the AppShell frame).
   */
  surface?: boolean;
}

const MAX_WIDTH: Record<NonNullable<CardProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  xl: 'max-w-xl',
};

/**
 * Primary app content panel using semantic card tokens. Page chrome lives on
 * {@link AppShell}, never on Card. Use `surface={false}` for a page-body
 * column inside the shell frame.
 *
 * @param props - See {@link CardProps}.
 * @returns The card element.
 */
export function Card({
  children,
  className,
  maxWidth = 'sm',
  surface = true,
}: CardProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const panel =
    surface === false
      ? `flex w-full ${MAX_WIDTH[maxWidth]} flex-col items-center gap-6`
      : `flex w-full ${MAX_WIDTH[maxWidth]} flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm`;

  return <section className={`${panel}${extra}`}>{children}</section>;
}
