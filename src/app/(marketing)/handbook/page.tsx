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
 * Title and description for `/handbook` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Handbook — 21.gifts',
  description: 'Screens, functions, and HTTP endpoints for the 21.gifts app.',
};

/**
 * Async app handbook page at `/handbook`: screens, functions, and HTTP endpoints.
 * Uses `getRequestLocale` for localized title/intro chrome; every chapter and
 * markdown heading has a copy-link button.
 *
 * Not `force-static`: the root layout reads cookies/Accept-Language for
 * `html lang` and the intro chrome. Markdown is loaded from `docs/handbook`
 * at request time (copied into the standalone server).
 *
 * @returns The handbook screen.
 */
export default async function HandbookPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const documents = loadHandbookDocuments();
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <div className="mt-2">
        <HandbookCopyLink targetId="handbook" label={translate(messages, 'handbook.title')} />
      </div>
      <HandbookIntro
        title={translate(messages, 'handbook.title')}
        introBefore={translate(messages, 'handbook.introBefore')}
        introAfter={translate(messages, 'handbook.introAfter')}
        navAria={translate(messages, 'aria.handbookSections')}
      >
        {documents.map((doc) => (
          <span key={doc.id} className="inline-flex items-baseline gap-1">
            <a href={`#${doc.id}`} className="text-[#f7931a] underline underline-offset-2">
              {doc.title}
            </a>
            <HandbookCopyLink targetId={doc.id} label={`${doc.title} chapter`} />
          </span>
        ))}
      </HandbookIntro>
      {documents.map((doc) => (
        <section key={doc.id} id={doc.id} className="mt-12">
          <HandbookMarkdown markdown={doc.markdown} idPrefix={doc.id} />
        </section>
      ))}
    </main>
  );
}
