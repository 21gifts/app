import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Reply,
  Search,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { ReactElement } from 'react';
import { HappylandSection } from '@/components/HappylandSection';
import { PwaInstall } from '@/components/PwaInstall';
import { ButtonLink } from '@/components/ui';
import { getCatalog, type MessageKey } from '@/lib/messages';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { PROJECT_DONATE_ADDRESS } from '@/lib/project-donate';
import { getRequestLocale } from '@/lib/request-locale';
import { localizedPublicPath } from '@/lib/public-locale-path';
import { translate } from '@/lib/translate';

/** Localized search and social preview for the marketing home. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  return marketingMetadata(
    '/',
    messages['home.metaTitle'],
    messages['home.metaDescription'],
    locale,
  );
}

/**
 * Direct Bitcoin giving journey, project context, and complete Happyland story.
 * @returns The localized marketing home.
 */
export default async function Home(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const t = (key: MessageKey): string => translate(messages, key);
  const faq = [
    ['home.faq1Q', 'home.faq1A'],
    ['home.faq2Q', 'home.faq2A'],
    ['home.faq3Q', 'home.faq3A'],
    ['home.faq4Q', 'home.faq4A'],
    ['home.faq5Q', 'home.faq5A'],
    ['home.faq6Q', 'home.faq6A'],
    ['home.faq7Q', 'home.faq7A'],
    ['home.faq8Q', 'home.faq8A'],
  ] as const;

  return (
    <main>
      <section className="relative isolate overflow-hidden border-b border-paper/10 px-5 pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_42%,rgba(247,147,26,0.17),transparent_45%)]"
        />
        <div className="mx-auto grid max-w-[1100px] items-center gap-14 lg:grid-cols-2 lg:gap-12">
          <div className="max-w-[560px]">
            <p className="text-xs font-semibold tracking-[0.22em] text-accent uppercase sm:text-sm">
              {t('home.heroKicker')}
            </p>
            <h1 className="mt-6 text-[clamp(3.25rem,5.8vw,5.7rem)] leading-[0.99] font-semibold tracking-[-0.055em]">
              {t('home.headline1')}
              <br />
              <span className="text-accent">{t('home.headline2')}</span>
            </h1>
            <p className="mt-7 max-w-[510px] text-lg leading-relaxed text-paper/75 sm:text-xl">
              {t('home.lead')}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/login" variant="accent" tone="dark">
                {t('home.ctaAsk')} <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink
                href={localizedPublicPath(locale, '/donate')}
                variant="secondary"
                tone="dark"
              >
                {t('home.ctaSend')}
              </ButtonLink>
              <PwaInstall tone="dark" placement="hero" />
            </div>
            <div className="mt-12 flex items-center gap-3 border-t border-paper/15 pt-5 text-sm text-paper/70">
              <Image
                src="/bitcoin-symbol.svg"
                alt=""
                loading="eager"
                width={36}
                height={36}
                className="block h-9 w-9 shrink-0"
              />
              <span>{t('home.heroProof')}</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[540px]">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-[2rem] border border-paper/10"
            />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-paper/15 bg-paper text-ink shadow-[0_32px_80px_rgba(0,0,0,0.3)] [color-scheme:light]">
              <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4 sm:px-8">
                <span className="text-sm font-bold tracking-tight">21.gifts</span>
                <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold">
                  {t('home.previewLabel')}
                </span>
              </div>
              <div className="px-6 pt-7 pb-6 sm:px-8 sm:pt-8">
                <p className="text-xs font-semibold tracking-[0.18em] text-ink/55 uppercase">
                  {t('home.previewKicker')}
                </p>
                <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-[2rem]">
                  {t('home.previewTitle')}
                </h2>
                <div className="mt-6 rounded-xl border border-ink/10 bg-[#faf9f7] p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                      <MessageCircle aria-hidden="true" className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <span className="text-sm font-semibold sm:text-base">
                      {t('home.previewStep1')}
                    </span>
                  </div>
                  <div className="ml-5 flex h-8 items-center border-l border-ink/20 pl-3">
                    <ArrowDown aria-hidden="true" className="h-4 w-4 text-ink/50" />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/50 bg-accent/10 p-3">
                    <span className="flex items-center gap-3">
                      <UserRound
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                        strokeWidth={1.6}
                      />
                      <span className="text-sm font-semibold sm:text-base">
                        {t('home.previewStep2')}
                      </span>
                    </span>
                    <Reply aria-hidden="true" className="h-5 w-5 shrink-0 text-[#b76100]" />
                  </div>
                  <div className="ml-5 flex h-8 items-center border-l border-ink/20 pl-3">
                    <ArrowDown aria-hidden="true" className="h-4 w-4 text-ink/50" />
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium sm:text-base">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-ink">
                      <Image
                        src="/bitcoin-symbol.svg"
                        alt=""
                        width={27}
                        height={27}
                        className="h-[27px] w-[27px]"
                      />
                    </span>
                    {t('home.previewStep3')}
                  </div>
                </div>
              </div>
              <div className="mx-3 mb-3 rounded-[1.1rem] bg-ink px-5 py-6 text-paper sm:mx-4 sm:mb-4 sm:px-6">
                <p className="text-center text-lg font-semibold">{t('home.previewWalletTitle')}</p>
                <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
                  <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-paper/15 bg-paper/5 px-1 py-3 text-center">
                    <Wallet aria-hidden="true" className="h-6 w-6 text-paper" strokeWidth={1.5} />
                    <span className="text-xs font-medium leading-tight text-paper/85 sm:text-sm">
                      {t('home.previewFrom')}
                    </span>
                  </div>
                  <div className="flex w-11 flex-col items-center justify-center gap-1.5 sm:w-14">
                    <Image
                      src="/bitcoin-symbol.svg"
                      alt=""
                      loading="eager"
                      width={48}
                      height={48}
                      className="block h-11 w-11 sm:h-12 sm:w-12"
                    />
                    <ArrowRight aria-hidden="true" className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-paper/15 bg-paper/5 px-1 py-3 text-center">
                    <UserRound
                      aria-hidden="true"
                      className="h-6 w-6 text-paper"
                      strokeWidth={1.5}
                    />
                    <span className="text-xs font-medium leading-tight text-paper/85 sm:text-sm">
                      {t('home.previewTo')}
                    </span>
                  </div>
                </div>
                <p className="mt-5 border-t border-paper/15 pt-4 text-center text-xs text-paper/65 sm:text-sm">
                  {t('home.previewWalletBody')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how"
        className="scroll-mt-20 bg-paper px-5 py-16 text-ink [color-scheme:light] sm:py-20"
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-ink/55 uppercase">
                {t('home.howKicker')}
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
                {t('home.howTitle')}
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink/65 sm:text-base">
              {t('home.howLead')}
            </p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {[
              { number: '01', Icon: Search, title: 'home.give1Title', body: 'home.give1Body' },
              {
                number: '02',
                Icon: MessageCircle,
                title: 'home.give2Title',
                body: 'home.give2Body',
              },
              { number: '03', Icon: Wallet, title: 'home.give3Title', body: 'home.give3Body' },
            ].map(({ number, Icon, title, body }) => (
              <article
                key={number}
                className="rounded-2xl border border-ink/10 bg-[#faf9f7] p-6 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink/50">{number}</span>
                  <Icon aria-hidden="true" className="h-6 w-6 stroke-[1.6]" />
                </div>
                <h3 className="mt-8 text-xl font-semibold tracking-tight">
                  {t(title as MessageKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{t(body as MessageKey)}</p>
              </article>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-6 py-5 text-paper sm:px-8">
            <p className="text-sm leading-relaxed text-paper/75">
              <span className="font-semibold text-paper">{t('home.receiveTitle')}</span>{' '}
              {t('home.receiveBody')}
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-paper underline decoration-accent underline-offset-4 hover:text-accent"
            >
              {t('home.ctaAsk')} <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-ink/10 bg-paper px-5 py-16 text-ink [color-scheme:light] sm:py-20">
        <div className="mx-auto max-w-[1100px]">
          <p className="text-xs font-bold tracking-[0.2em] text-ink/55 uppercase">21.gifts</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('home.discoverTitle')}
          </h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <Link
              href="#happyland"
              className="group overflow-hidden rounded-2xl border border-ink/10 bg-[#faf9f7] transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="flex h-48 flex-col justify-end overflow-hidden bg-[radial-gradient(circle_at_75%_25%,#5b3a1e,#211b18_60%)] p-7 text-paper">
                <span className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                  {messages['happyland.kicker']}
                </span>
                <span className="mt-3 text-4xl font-semibold tracking-tight">Happyland</span>
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold tracking-[0.15em] text-ink/55 uppercase">
                  {t('home.discoverStoryKicker')}
                </span>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold">{t('home.discoverStoryTitle')}</h3>
                  <ArrowUpRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-ink/60" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {t('home.discoverStoryBody')}
                </p>
              </div>
            </Link>
            <Link
              href="#why"
              className="group overflow-hidden rounded-2xl border border-ink/10 bg-[#faf9f7] transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="flex h-48 items-center justify-center bg-[#18120d]">
                <Image
                  src="/bitcoin-symbol.svg"
                  alt=""
                  loading="eager"
                  width={112}
                  height={112}
                  className="block h-28 w-28 drop-shadow-[0_0_35px_rgba(247,147,26,0.28)]"
                />
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold tracking-[0.15em] text-ink/55 uppercase">
                  {t('home.discoverBitcoinKicker')}
                </span>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold">{t('home.discoverBitcoinTitle')}</h3>
                  <ArrowUpRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-ink/60" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {t('home.discoverBitcoinBody')}
                </p>
              </div>
            </Link>
            <Link
              href="#faq"
              className="group overflow-hidden rounded-2xl border border-ink/10 bg-[#faf9f7] transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="flex h-48 items-center justify-center bg-ink px-7">
                <div
                  aria-hidden="true"
                  className="flex w-full max-w-[250px] items-center justify-between gap-3"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent text-2xl text-paper">
                    <Wallet className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                  <span className="h-px flex-1 bg-accent" />
                  <Image
                    src="/bitcoin-symbol.svg"
                    alt=""
                    loading="eager"
                    width={64}
                    height={64}
                    className="block h-16 w-16 shrink-0"
                  />
                  <span className="h-px flex-1 bg-accent" />
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent text-2xl text-paper">
                    <UserRound className="h-6 w-6" strokeWidth={1.5} />
                  </span>
                </div>
              </div>
              <div className="p-6">
                <span className="text-xs font-semibold tracking-[0.15em] text-ink/55 uppercase">
                  {t('home.discoverTrustKicker')}
                </span>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold">{t('home.discoverTrustTitle')}</h3>
                  <ArrowUpRight aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-ink/60" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {t('home.discoverTrustBody')}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section
        id="why"
        className="scroll-mt-20 border-t border-ink/10 bg-[#f5f2ec] px-5 py-20 text-ink [color-scheme:light] sm:py-24"
      >
        <div className="mx-auto grid max-w-[1100px] gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-ink/55 uppercase">
              {t('home.whyKicker')}
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {t('home.whyTitle')}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['1', '2', '3', '4'] as const).map((number) => (
              <article key={number} className="rounded-2xl border border-ink/10 bg-paper p-6">
                <span className="text-xs font-semibold text-ink/45">0{number}</span>
                <h3 className="mt-6 text-lg font-semibold">{t(`home.why${number}Title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">
                  {t(`home.why${number}Body`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <HappylandSection locale={locale} />

      <section
        id="project"
        className="scroll-mt-20 border-b border-paper/10 bg-ink px-5 py-20 sm:py-24"
      >
        <div className="mx-auto grid max-w-[1100px] gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
              {t('home.projectKicker')}
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {t('home.projectTitle')}
            </h2>
          </div>
          <div>
            <p className="max-w-xl text-lg leading-relaxed text-paper/70">
              {t('home.projectLead')}
            </p>
            <div className="mt-7 inline-flex max-w-full flex-col gap-2 rounded-xl border border-paper/15 bg-paper/5 px-5 py-4">
              <span className="text-xs font-semibold tracking-widest text-paper/50 uppercase">
                Wallet of Satoshi
              </span>
              <a
                href={`lightning:${PROJECT_DONATE_ADDRESS}`}
                className="text-accent underline underline-offset-2 hover:text-paper"
              >
                <code className="font-mono text-sm break-all sm:text-base">
                  {PROJECT_DONATE_ADDRESS}
                </code>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 bg-ink px-5 py-20 sm:py-24">
        <div className="mx-auto grid max-w-[1100px] gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">
              {t('home.faqKicker')}
            </p>
            <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {t('home.faqTitle')}
            </h2>
          </div>
          <div className="divide-y divide-paper/15 border-t border-paper/15">
            {faq.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="min-h-11 cursor-pointer pr-4 text-base font-medium marker:text-accent hover:text-accent">
                  {t(question)}
                </summary>
                <p className="pb-2 pl-5 text-sm leading-relaxed text-paper/65">{t(answer)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
