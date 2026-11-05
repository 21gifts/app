import type { ReactElement, ReactNode } from 'react';
import { Scrollport } from '@/components/ui/Scrollport';

/**
 * Scrolls the open list only when the pinned box is shorter than the options.
 *
 * @param props - Whether the list scrolls, and the option rows.
 * @returns The rows, or those rows inside the active scrollport.
 */
export function MenuScroll({
  scrolling,
  children,
}: {
  scrolling: boolean;
  children: ReactNode;
}): ReactElement {
  if (!scrolling) return <>{children}</>;
  return <Scrollport className="flex-1">{children}</Scrollport>;
}
