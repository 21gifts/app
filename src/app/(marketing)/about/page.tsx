import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ButtonLink } from '@/components/ui';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Title and description for `/about` (overrides the root layout metadata).
 */
export const metadata: Metadata = {
  title: 'About — 21.gifts',
  description: 'Where 21.gifts comes from: a house of hospitality, open to everyone.',
};

/**
 * Origin of the house at `/about`: hospitality, one verse, and an open door.
 *
 * @returns The about screen.
 */
export default async function AboutPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const t = (key: MessageKey): string => translate(messages, key);

  return (
    <main>
      <section className="px-5 pt-28 pb-12 sm:pt-36">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t('about.kicker')}
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            {t('about.heading')}
          </h1>
          <p className="mt-6 text-lg text-paper/60">{t('about.lead')}</p>
          <blockquote className="mt-12 border-l-2 border-accent pl-5">
            <p className="text-xl italic text-paper/80">{t('about.verse')}</p>
            <footer className="mt-3 text-sm font-medium tracking-widest text-accent uppercase">
              {t('about.verseRef')}
            </footer>
          </blockquote>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm font-medium tracking-widest text-accent uppercase">
          {t('about.originKicker')}
        </p>
        <h2 className="mt-3 text-2xl font-semibold">{t('about.originTitle')}</h2>
        <div className="mt-8 space-y-6 text-paper/60">
          <p>{t('about.originBody1')}</p>
          <p>{t('about.originBody2')}</p>
          <p>{t('about.originBody3')}</p>
        </div>
        <ButtonLink href="/welcome" variant="accent" tone="dark" className="mt-10">
          {t('about.ctaForum')}
        </ButtonLink>
      </section>
    </main>
  );
}
