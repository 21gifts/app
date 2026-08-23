import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookIntro } from '@/components/HandbookIntro';
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
 * Title/intro chrome is a client island so this page can stay `force-static`
 * (standalone has no `docs/` tree at runtime). Markdown bodies stay English.
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
