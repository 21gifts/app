import type { ReactElement, ReactNode } from 'react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';
import { Scrollport } from '@/components/ui/Scrollport';

/**
 * Dark shell for marketing routes (`/`, `/about`, `/legal`, `/handbook`, `/stats`): header, page, footer.
 *
 * @param children - Nested page.
 * @returns The async marketing wrapper (does not replace the root html/body).
 */
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const footer = await MarketingFooter();
  return (
    <div className="flex h-[var(--app-height)] min-h-0 flex-col bg-ink text-paper [color-scheme:dark]">
      <Scrollport className="flex-1">
        <MarketingHeader />
        {children}
        {footer}
      </Scrollport>
    </div>
  );
}
