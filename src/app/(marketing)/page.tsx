import Link from 'next/link';
import type { ReactElement } from 'react';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { translate } from '@/lib/translate';

/**
 * Marketing landing at `/`: pitch, how it works, why, FAQ, CTAs into the app.
 *
 * @returns The home screen.
 */
export default async function Home(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const t = (key: MessageKey): string => translate(messages, key);

  return (
    <main>
      <section className="relative overflow-hidden px-5 pt-28 pb-20 sm:pt-36">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            {t('home.headline1')}
            <br />
            {t('home.headline2')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/60">{t('home.lead')}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/login"
              className="rounded-full bg-[#f7931a] px-6 py-3 font-medium text-[#0a090c] no-underline"
            >
              {t('home.ctaAsk')}
            </Link>
            <Link
              href="/donate"
              className="rounded-full border border-white/20 px-6 py-3 font-medium text-white no-underline"
            >
              {t('home.ctaSend')}
            </Link>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">{t('home.howKicker')}</h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.howTitle')}</p>
        <p className="mt-4 max-w-3xl text-white/60">{t('home.howLead')}</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-3">
          <div>
            <span className="text-sm text-white/60">01</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step1Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.step1Body')}</p>
          </div>
          <div>
            <span className="text-sm text-white/60">02</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step2Title')}</h3>
            <p className="mt-2 text-white/60">
              {t('home.step2BodyBefore')} <code>name@domain</code> {t('home.step2BodyAfter')}
            </p>
          </div>
          <div>
            <span className="text-sm text-white/60">03</span>
            <h3 className="mt-2 text-xl font-semibold">{t('home.step3Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.step3Body')}</p>
          </div>
        </div>
      </section>

      <section id="why" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">{t('home.whyKicker')}</h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.whyTitle')}</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <h3 className="text-xl font-semibold">{t('home.why1Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.why1Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('home.why2Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.why2Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('home.why3Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.why3Body')}</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold">{t('home.why4Title')}</h3>
            <p className="mt-2 text-white/60">{t('home.why4Body')}</p>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[1100px] px-5 py-20">
        <h2 className="text-sm tracking-widest text-[#f7931a] uppercase">{t('home.faqKicker')}</h2>
        <p className="mt-3 text-2xl font-semibold">{t('home.faqTitle')}</p>
        <div className="mt-10 space-y-3">
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq1Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq1A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq2Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq2A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq3Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq3A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq4Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq4A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq5Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq5A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq6Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq6A')}</p>
          </details>
          <details className="border-b border-white/10 py-4">
            <summary className="cursor-pointer font-medium">{t('home.faq7Q')}</summary>
            <p className="mt-3 text-white/60">{t('home.faq7A')}</p>
          </details>
        </div>
      </section>
    </main>
  );
}
