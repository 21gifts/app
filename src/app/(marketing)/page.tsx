import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactElement } from 'react';
import { PwaInstall } from '@/components/PwaInstall';
import { HappylandSection } from '@/components/HappylandSection';
import { ButtonLink } from '@/components/ui';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { lightningHref } from '@/lib/payment-link';
import { projectDonateAddress } from '@/lib/project-donate';
import { translate } from '@/lib/translate';

/**
 * Canonical `/` for the marketing landing (does not override the root title).
 */
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

/**
 * 21.gifts host this request was made on, without a port (`x-forwarded-host`
 * first). Only `21.gifts` and its subdomains are taken from the request; any
 * other or missing host yields `21.gifts`, so a forged header cannot redirect
 * the donation address.
 *
 * @returns `21.gifts` or one of its subdomains.
 */
async function requestHostname(): Promise<string> {
  const headerStore = await headers();
  const raw = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? '';
  const host = raw.replace(/,.*$/, '').trim().replace(/:\d+$/, '').toLowerCase();
  return /^([a-z0-9-]+\.)*21\.gifts$/.test(host) ? host : '21.gifts';
}

/**
 * Marketing landing at `/`: pitch, how it works, why, project donate (`#project`,
 * only when the build names the platform account), FAQ, CTAs into the app,
 * and an optional PWA install control after Send help.
 *
 * @returns The home screen.
 */
export default async function Home(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const t = (key: MessageKey): string => translate(messages, key);
  const donateAddress = projectDonateAddress(await requestHostname());

  return (
    <main>
      <section className="relative overflow-hidden px-5 pt-28 pb-20 sm:pt-36">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            {t('home.headline1')}
            <br />
            {t('home.headline2')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-paper/60">{t('home.lead')}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/login" variant="accent" tone="dark">
              {t('home.ctaAsk')}
            </ButtonLink>
            <ButtonLink href="/donate" variant="secondary" tone="dark">
              {t('home.ctaSend')}
            </ButtonLink>
            <PwaInstall tone="dark" placement="hero" />
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm font-medium tracking-widest text-accent uppercase">
          {t('home.howKicker')}
        </h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.howTitle')}</p>
        <p className="mt-4 max-w-3xl text-paper/60">{t('home.howLead')}</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <div>
            <span className="text-sm text-paper/60">01</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step1Title')}</h3>
            <p className="mt-2 text-paper/60">{t('home.step1Body')}</p>
          </div>
          <div>
            <span className="text-sm text-paper/60">02</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step2Title')}</h3>
            <p className="mt-2 text-paper/60">
              {t('home.step2BodyBefore')} <code>you@21.gifts</code>
              {t('home.step2BodyAfter')}
            </p>
          </div>
          <div>
            <span className="text-sm text-paper/60">03</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step3Title')}</h3>
            <p className="mt-2 text-paper/60">{t('home.step3Body')}</p>
          </div>
        </div>
      </section>

      <HappylandSection locale={locale} />

      <section id="why" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm font-medium tracking-widest text-accent uppercase">
          {t('home.whyKicker')}
        </h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.whyTitle')}</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold">{t('home.why1Title')}</h3>
            <p className="mt-2 text-paper/60">{t('home.why1Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('home.why2Title')}</h3>
            <p className="mt-2 text-paper/60">{t('home.why2Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('home.why3Title')}</h3>
            <p className="mt-2 text-paper/60">{t('home.why3Body')}</p>
          </div>
        </div>
      </section>

      {donateAddress !== null ? (
        <section id="project" className="mx-auto max-w-[1100px] px-5 py-20">
          <p className="text-sm font-medium tracking-widest text-accent uppercase">
            {t('home.projectKicker')}
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{t('home.projectTitle')}</h2>
          <p className="mt-4 max-w-3xl text-paper/60">{t('home.projectLead')}</p>
          <p className="mt-6">
            <a
              href={lightningHref(donateAddress)}
              className="text-accent underline underline-offset-2"
            >
              <code className="font-mono text-sm">{donateAddress}</code>
            </a>
          </p>
        </section>
      ) : null}

      <section id="faq" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm font-medium tracking-widest text-accent uppercase">
          {t('home.faqKicker')}
        </h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.faqTitle')}</p>
        <div className="mt-10 space-y-3">
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq1Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq1A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq3Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq3A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq4Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq4A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq5Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq5A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq6Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq6A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq7Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq7A')}</p>
          </details>
          <details className="border-b border-paper/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq8Q')}</summary>
            <p className="mt-3 text-paper/60">{t('home.faq8A')}</p>
          </details>
        </div>
      </section>
    </main>
  );
}
