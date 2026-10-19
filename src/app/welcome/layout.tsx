import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** The signed-in living room is not public search content. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Segment layout for `/welcome`. Search exclusion lives here so the page stays a client component.
 *
 * @param children - Nested page.
 * @returns The nested page, unchanged.
 */
export default function WelcomeLayout({ children }: { children: ReactNode }): ReactNode {
  return children;
}
