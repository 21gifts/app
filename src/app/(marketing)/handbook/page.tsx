import type { Metadata } from 'next';
import type { ReactElement } from 'react';
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
      <HandbookIntro />
      <nav aria-label="Handbook sections" className="mt-8 flex flex-wrap gap-4 text-sm">
        {documents.map((doc) => (
          <a
            key={doc.id}
            href={`#${doc.id}`}
            className="text-[#f7931a] underline underline-offset-2"
          >
            {doc.title}
          </a>
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
