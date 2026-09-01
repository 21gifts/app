import type { ReactElement, ReactNode } from 'react';

/** Props for {@link PageChrome}. */
export interface PageChromeProps {
  /** Page body. */
  children: ReactNode;
  /** Optional absolute top-left chrome (wordmark). */
  topLeft?: ReactNode;
  /** Optional absolute top-right chrome (menu, language, theme). */
  topRight?: ReactNode;
  /** Extra classes on the outer `<main>`. */
  className?: string;
}

/**
 * Full-height app page shell with optional top-left and top-right slots.
 *
 * @param props - See {@link PageChromeProps}.
 * @returns The page chrome element.
 */
export function PageChrome({
  children,
  topLeft,
  topRight,
  className,
}: PageChromeProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasLeft = topLeft !== undefined && topLeft !== null;
  const hasRight = topRight !== undefined && topRight !== null;
  return (
    <main
      className={`relative flex min-h-screen flex-col items-center justify-center gap-10 px-6${extra}`}
    >
      {hasLeft ? <div className="absolute top-4 left-5 z-40">{topLeft}</div> : null}
      {hasRight ? (
        <div className="absolute top-4 right-5 z-40 flex items-center gap-2">{topRight}</div>
      ) : null}
      {children}
    </main>
  );
}
