import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Title and description for `/terms` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'Terms of Use — 21.gifts',
  description: 'Terms of Use of 21.gifts.',
};

/** Catalog keys of the numbered clauses, in order: short heading, then body. */
const TERMS_CLAUSES = [
  { title: 'terms.clause1Title', body: 'terms.clause1' },
  { title: 'terms.clause2Title', body: 'terms.clause2' },
  { title: 'terms.clause3Title', body: 'terms.clause3' },
  { title: 'terms.clause4Title', body: 'terms.clause4' },
  { title: 'terms.clause5Title', body: 'terms.clause5' },
] as const satisfies readonly { title: MessageKey; body: MessageKey }[];

/**
 * Terms of Use at `/terms`: the "Wallet and data" section, five numbered clauses each with a
 * short heading, in the visitor's locale.
 *
 * @returns The terms screen.
 */
export default async function TermsPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const t = (key: MessageKey): string => translate(messages, key);

  return (
    <main className="mx-auto max-w-3xl px-5 py-24">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">{t('terms.title')}</h1>
        <p className="text-sm text-paper/60">{t('terms.lastUpdated')}</p>
        <h2 id="wallet-and-data" className="pt-4 text-xl font-semibold">
          {t('terms.heading')}
        </h2>
        <ol className="list-decimal space-y-3 pl-6 text-paper/70">
          {TERMS_CLAUSES.map((clause) => (
            <li key={clause.body}>
              <strong className="font-semibold text-paper">{t(clause.title)}.</strong>{' '}
              {t(clause.body)}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
