import type { Metadata } from 'next';
import type { ReactElement } from 'react';
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
 * @returns The handbook screen.
 */
export default function HandbookPage(): ReactElement {
  const documents = loadHandbookDocuments();
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <h1 className="text-3xl font-semibold">Handbook</h1>
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
