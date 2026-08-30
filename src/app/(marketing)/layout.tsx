import type { ReactElement, ReactNode } from 'react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';

/**
 * Dark shell for marketing routes (`/`, `/legal`, `/handbook`, `/stats`): header, page, footer.
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
    <div className="min-h-screen bg-[#0a090c] text-white [color-scheme:dark]">
      <MarketingHeader />
      {children}
      {footer}
    </div>
  );
}
