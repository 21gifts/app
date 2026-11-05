import type { ReactElement, ReactNode } from 'react';
import { Scrollport } from '@/components/ui/Scrollport';

/**
 * Scrolls filter list or help panel content when its pinned box is too short.
 *
 * @param props - Whether the content scrolls, and the content.
 * @returns The content directly, or inside the active scrollport.
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
