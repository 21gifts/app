import type { ReactElement, ReactNode } from 'react';

/** Props for {@link PageChrome}. */
export interface PageChromeProps {
  /** Page body. */
  children: ReactNode;
  /** Optional absolute top-right chrome (menu, language, theme). */
  topRight?: ReactNode;
  /** Extra classes on the outer `<main>`. */
  className?: string;
}

/**
 * Full-height app page shell with an optional top-right slot.
 *
 * @param props - See {@link PageChromeProps}.
 * @returns The page chrome element.
 */
export function PageChrome({ children, topRight, className }: PageChromeProps): ReactElement {
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  return (
    <main
      className={`relative flex min-h-screen flex-col items-center justify-center gap-10 px-6${extra}`}
    >
      {topRight !== undefined && topRight !== null ? (
        <div className="absolute top-4 right-5 flex items-center gap-2">{topRight}</div>
      ) : null}
      {children}
    </main>
  );
}
