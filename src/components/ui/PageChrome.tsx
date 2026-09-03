import type { ReactElement, ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

/** Props for {@link PageChrome}. */
export interface PageChromeProps {
  /** Page body. */
  children: ReactNode;
  /** Optional absolute top-left chrome (wordmark). */
  topLeft?: ReactNode;
  /** Optional absolute top-right chrome (menu, language, theme). */
  topRight?: ReactNode;
  /** Extra classes on the outer `<main>` — never viewport height classes. */
  className?: string;
}

/**
 * Flow-mode app page wrapper around {@link AppShell} with optional chrome slots.
 * Prefer {@link AppShell} directly on app routes.
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
  return (
    <AppShell
      mode="flow"
      topLeft={topLeft}
      topRight={topRight}
      {...(className === undefined ? {} : { className })}
    >
      {children}
    </AppShell>
  );
}
