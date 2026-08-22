import type { ReactElement, ReactNode } from 'react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';

/**
 * Dark shell for marketing routes (`/` and `/legal`): header, page, footer.
 *
 * @param children - Nested page.
 * @returns The marketing wrapper (does not replace the root html/body).
 */
export default function MarketingLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="min-h-screen bg-[#0a090c] text-white">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
