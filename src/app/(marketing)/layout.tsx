import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '@/components/LocaleProvider';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';
import { Scrollport } from '@/components/ui/Scrollport';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';

/**
 * Dark shell for marketing routes (`/`, `/about`, `/legal`, `/terms`, `/handbook`, `/stats`): header, page,
 * footer.
 * This segment can render without the root layout, so it provides the locale itself.
 *
 * @param children - Nested page.
 * @returns The async marketing wrapper (does not replace the root html/body).
 */
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const footer = await MarketingFooter();
  return (
    <LocaleProvider locale={locale} messages={getCatalog(locale)}>
      <div className="flex h-[var(--app-height)] min-h-0 flex-col bg-ink text-paper [color-scheme:dark]">
        <Scrollport className="flex-1 bg-ink">
          <MarketingHeader />
          {children}
          {footer}
        </Scrollport>
      </div>
    </LocaleProvider>
  );
}
