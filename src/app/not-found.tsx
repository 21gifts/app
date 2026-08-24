import Link from 'next/link';
import type { ReactElement } from 'react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog } from '@/lib/messages';
import { translate } from '@/lib/translate';

/**
 * Dark not-found page with a link home. Uses the marketing chrome because this
 * file sits outside the `(marketing)` route group.
 *
 * @returns The 404 screen.
 */
export default async function NotFound(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const footer = await MarketingFooter();

  return (
    <div className="min-h-screen bg-[#0a090c] text-white">
      <MarketingHeader />
      <main className="mx-auto flex max-w-[1100px] flex-col items-start px-5 py-28">
        <h1 className="text-5xl font-semibold">404</h1>
        <p className="mt-4 text-white/60">{translate(messages, 'notFound.body')}</p>
        <Link
          href="/"
          className="mt-8 rounded-full bg-[#f7931a] px-6 py-3 font-medium text-[#0a090c] no-underline"
        >
          {translate(messages, 'notFound.back')}
        </Link>
      </main>
      {footer}
    </div>
  );
}
