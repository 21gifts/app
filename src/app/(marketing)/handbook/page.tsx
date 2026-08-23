import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { loadHandbookDocuments } from '@/lib/handbook';
import { HandbookMarkdown } from '@/lib/handbook-markdown';

/** Pin `/handbook` to a build-time static page (markdown is read from disk at build). */
export const dynamic = 'force-static';

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
 * @returns The handbook screen.
 */
export default function HandbookPage(): ReactElement {
  const documents = loadHandbookDocuments();
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 id="handbook" className="scroll-mt-24 text-3xl font-semibold">
          Handbook
        </h1>
        <HandbookCopyLink targetId="handbook" label="Handbook" />
      </div>
      <p className="mt-4 text-white/60">
        This is the 21.gifts app handbook: screens, functions, and HTTP endpoints. The api handbook
        lives in{' '}
        <a
          className="text-[#f7931a] underline underline-offset-2"
          href="https://github.com/21gifts/api/tree/develop/docs/handbook"
        >
          21gifts/api
        </a>
        .
      </p>
      <nav aria-label="Handbook sections" className="mt-8 flex flex-wrap gap-4 text-sm">
        {documents.map((doc) => (
          <span key={doc.id} className="inline-flex items-baseline gap-1">
            <a href={`#${doc.id}`} className="text-[#f7931a] underline underline-offset-2">
              {doc.title}
            </a>
            <HandbookCopyLink targetId={doc.id} label={`${doc.title} chapter`} />
          </span>
        ))}
      </nav>
      {documents.map((doc) => (
        <section key={doc.id} id={doc.id} className="mt-12">
          <HandbookMarkdown markdown={doc.markdown} idPrefix={doc.id} />
        </section>
      ))}
    </main>
  );
}
