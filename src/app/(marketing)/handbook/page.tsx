import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookIntro } from '@/components/HandbookIntro';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Title and description for `/handbook` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Handbook — 21.gifts',
  description: 'Screens, functions, and HTTP endpoints for the 21.gifts app.',
};

/**
 * Async handbook hub at `/handbook`: describes and links the three parts.
 * Does not dump screens, functions, or endpoints markdown.
 *
 * @returns The handbook hub screen.
 */
export default async function HandbookPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const screensTitle = translate(messages, 'handbook.screensTitle');
  const functionsTitle = translate(messages, 'handbook.functionsTitle');
  const endpointsTitle = translate(messages, 'handbook.endpointsTitle');
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <HandbookIntro
        title={translate(messages, 'handbook.title')}
        introBefore={translate(messages, 'handbook.introBefore')}
        introAfter={translate(messages, 'handbook.introAfter')}
        navAria={translate(messages, 'aria.handbookSections')}
        headingAction={
          <HandbookCopyLink targetId="handbook" label={translate(messages, 'handbook.title')} />
        }
      >
        <a href="/handbook/screens" className="text-[#f7931a] underline underline-offset-2">
          {screensTitle}
        </a>
        <a href="/handbook/functions" className="text-[#f7931a] underline underline-offset-2">
          {functionsTitle}
        </a>
        <a href="/handbook/endpoints" className="text-[#f7931a] underline underline-offset-2">
          {endpointsTitle}
        </a>
      </HandbookIntro>
      <ul className="mt-12 flex flex-col gap-8">
        <li>
          <h2 className="text-xl font-semibold text-[#f7931a]">{screensTitle}</h2>
          <p className="mt-2 text-white/60">{translate(messages, 'handbook.screensLead')}</p>
          <a
            href="/handbook/screens"
            className="mt-2 inline-block text-[#f7931a] underline underline-offset-2"
          >
            {screensTitle}
          </a>
        </li>
        <li>
          <h2 className="text-xl font-semibold text-[#f7931a]">{functionsTitle}</h2>
          <p className="mt-2 text-white/60">{translate(messages, 'handbook.functionsLead')}</p>
          <a
            href="/handbook/functions"
            className="mt-2 inline-block text-[#f7931a] underline underline-offset-2"
          >
            {functionsTitle}
          </a>
        </li>
        <li>
          <h2 className="text-xl font-semibold text-[#f7931a]">{endpointsTitle}</h2>
          <p className="mt-2 text-white/60">{translate(messages, 'handbook.endpointsLead')}</p>
          <a
            href="/handbook/endpoints"
            className="mt-2 inline-block text-[#f7931a] underline underline-offset-2"
          >
            {endpointsTitle}
          </a>
        </li>
      </ul>
    </main>
  );
}
