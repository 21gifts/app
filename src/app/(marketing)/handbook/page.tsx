import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookIntro } from '@/components/HandbookIntro';
import { loadHandbookDocuments } from '@/lib/handbook';
import { HandbookMarkdown } from '@/lib/handbook-markdown';

/**
 * Title and description for `/handbook` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Handbook — 21.gifts',
  description: 'Screens, functions, and HTTP endpoints for the 21.gifts app.',
};

/**
 * App handbook at `/handbook`: screens, functions, and HTTP endpoints.
 * Every chapter and markdown heading has a copy-link button.
 *
 * Not `force-static`: the root layout reads cookies/Accept-Language for
 * `html lang` and the intro chrome. Markdown is loaded from `docs/handbook`
 * at request time (copied into the standalone server).
 *
 * @returns The handbook screen.
 */
export default function HandbookPage(): ReactElement {
  const documents = loadHandbookDocuments();
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <div className="mt-2">
        <HandbookCopyLink targetId="handbook" label="Handbook" />
      </div>
      <HandbookIntro>
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
