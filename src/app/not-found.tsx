import type { ReactElement } from 'react';
import { MarketingFooter } from '@/components/MarketingFooter';
import { MarketingHeader } from '@/components/MarketingHeader';
import { ButtonLink } from '@/components/ui';
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
    <div className="min-h-[var(--app-height)] bg-ink text-paper [color-scheme:dark]">
      <MarketingHeader />
      <main className="mx-auto flex max-w-[1100px] flex-col items-start px-5 py-28">
        <h1 className="text-5xl font-semibold">404</h1>
        <p className="mt-4 text-paper/60">{translate(messages, 'notFound.body')}</p>
        <ButtonLink href="/" variant="accent" tone="dark" className="mt-8">
          {translate(messages, 'notFound.back')}
        </ButtonLink>
      </main>
      {footer}
    </div>
  );
}
