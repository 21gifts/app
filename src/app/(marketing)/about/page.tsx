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
  description: 'Three convictions 21.gifts stands on.',
};

/**
 * Three convictions the house stands on at `/about`, with Matthew 10:8.
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
        <article>
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t('about.conv1Num')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{t('about.conv1Title')}</h2>
          <p className="mt-6 text-paper/60">{t('about.conv1Body')}</p>
          <p className="mt-6 text-paper/60">{t('about.conv1Body2')}</p>
          <blockquote className="mt-8 border-l-2 border-accent pl-5">
            <p className="text-xl italic text-paper/80">{t('about.conv1Verse')}</p>
            <footer className="mt-3 text-sm font-medium tracking-widest text-accent uppercase">
              {t('about.conv1VerseRef')}
            </footer>
          </blockquote>
        </article>
        <article className="mt-16">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t('about.conv2Num')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{t('about.conv2Title')}</h2>
          <p className="mt-6 text-paper/60">{t('about.conv2Body')}</p>
        </article>
        <article className="mt-16">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t('about.conv3Num')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{t('about.conv3Title')}</h2>
          <p className="mt-6 text-paper/60">{t('about.conv3Body')}</p>
        </article>
        <ButtonLink href="/welcome" variant="accent" tone="dark" className="mt-10">
          {t('about.ctaForum')}
        </ButtonLink>
      </section>
    </main>
  );
}
