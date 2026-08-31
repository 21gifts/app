import type { ReactElement, ReactNode } from 'react';

/** Props for {@link Card}. */
export interface CardProps {
  /** Card body. */
  children: ReactNode;
  /** Extra classes on the section. */
  className?: string;
  /** Max width utility; default `max-w-sm`. */
  maxWidth?: 'sm' | 'md' | 'xl';
}

const MAX_WIDTH: Record<NonNullable<CardProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  xl: 'max-w-xl',
};

/**
 * Primary app content panel using semantic card tokens.
 *
 * @param props - See {@link CardProps}.
 * @returns The card element.
 */
export function Card({ children, className, maxWidth = 'sm' }: CardProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  return (
    <section
      className={`flex w-full ${MAX_WIDTH[maxWidth]} flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm${extra}`}
    >
      {children}
    </section>
  );
}
