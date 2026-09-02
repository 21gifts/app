import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookIntro } from '@/components/HandbookIntro';
import { loadHandbookDocuments } from '@/lib/handbook';
import { HandbookMarkdown } from '@/lib/handbook-markdown';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Title and description for `/handbook/functions`.
 */
export const metadata: Metadata = {
  title: 'Functions — Handbook — 21.gifts',
  description: 'Exported functions for the 21.gifts app.',
};

/**
 * Async functions handbook page: markdown only (no image switches).
 *
 * @returns The functions handbook screen.
 */
export default async function HandbookFunctionsPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const documents = loadHandbookDocuments();
  const doc = documents.find((item) => item.id === 'functions');
  const title = translate(messages, 'handbook.functionsTitle');
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <HandbookIntro
        title={title}
        introBefore={translate(messages, 'handbook.functionsLead')}
        introAfter=""
        navAria={translate(messages, 'aria.handbookSections')}
        headingAction={<HandbookCopyLink targetId="handbook" label={title} />}
      >
        <a href="/handbook" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.title')}
        </a>
        <a href="/handbook/screens" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.screensTitle')}
        </a>
        <a href="/handbook/endpoints" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.endpointsTitle')}
        </a>
      </HandbookIntro>
      {doc !== undefined ? (
        <section id="functions" className="mt-12">
          <HandbookMarkdown
            markdown={doc.markdown.replace(/^# Functions\n+/, '')}
            idPrefix="functions"
          />
        </section>
      ) : null}
    </main>
  );
}
