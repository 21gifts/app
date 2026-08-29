import Link from 'next/link';
import type { ReactElement } from 'react';
import type { MessageKey, Messages } from '@/lib/messages';
import { translate } from '@/lib/translate';

/** Props for {@link RulesDocument}. */
export interface RulesDocumentProps {
  /** Catalog for the negotiated request locale. */
  messages: Messages;
}

/**
 * Presentational living-room rules body: lead, three laws, wanted / allowed /
 * rather-not / forbidden lists, house right, and CTAs to `/contact` and `/welcome`.
 *
 * Server component — copy comes from {@link translate} + the request catalog.
 *
 * @param props - Locale catalog for every `rules.*` key.
 * @returns The rules document.
 */
export function RulesDocument({ messages }: RulesDocumentProps): ReactElement {
  const t = (key: MessageKey): string => translate(messages, key);

  const wanted = [
    'rules.wanted1',
    'rules.wanted2',
    'rules.wanted3',
    'rules.wanted4',
    'rules.wanted5',
    'rules.wanted6',
  ] as const;
  const allowed = [
    'rules.allowed1',
    'rules.allowed2',
    'rules.allowed3',
    'rules.allowed4',
    'rules.allowed5',
  ] as const;
  const ratherNot = [
    'rules.ratherNot1',
    'rules.ratherNot2',
    'rules.ratherNot3',
    'rules.ratherNot4',
    'rules.ratherNot5',
    'rules.ratherNot6',
    'rules.ratherNot7',
    'rules.ratherNot8',
  ] as const;
  const forbiddenQuid = [
    'rules.forbiddenQuid1',
    'rules.forbiddenQuid2',
    'rules.forbiddenQuid3',
    'rules.forbiddenQuid4',
    'rules.forbiddenQuid5',
    'rules.forbiddenQuid6',
  ] as const;
  const forbiddenDonor = [
    'rules.forbiddenDonor1',
    'rules.forbiddenDonor2',
    'rules.forbiddenDonor3',
    'rules.forbiddenDonor4',
    'rules.forbiddenDonor5',
  ] as const;
  const forbiddenOther = [
    'rules.forbiddenOther1',
    'rules.forbiddenOther2',
    'rules.forbiddenOther3',
    'rules.forbiddenOther4',
    'rules.forbiddenOther5',
  ] as const;

  return (
    <article className="flex w-full max-w-3xl flex-col gap-10 text-neutral-900">
      <p className="text-base leading-relaxed text-neutral-700">{t('rules.lead')}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.law1Title')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.law1Body')}</p>
        <p className="text-sm font-medium leading-relaxed text-neutral-900">
          {t('rules.law1Test')}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.law2Title')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.law2Body')}</p>
        <p className="text-sm font-medium leading-relaxed text-neutral-900">
          {t('rules.law2Test')}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.law3Title')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.law3Body')}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.wantedHeading')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.wantedLead')}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
          {wanted.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.allowedHeading')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.allowedLead')}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
          {allowed.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.ratherNotHeading')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.ratherNotLead')}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
          {ratherNot.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.forbiddenHeading')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.forbiddenLead')}</p>

        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold tracking-tight">
            {t('rules.forbiddenQuidHeading')}
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
            {forbiddenQuid.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold tracking-tight">
            {t('rules.forbiddenDonorHeading')}
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
            {forbiddenDonor.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold tracking-tight">
            {t('rules.forbiddenOtherHeading')}
          </h3>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-neutral-700">
            {forbiddenOther.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t('rules.houseHeading')}</h2>
        <p className="text-sm leading-relaxed text-neutral-700">{t('rules.houseBody')}</p>
      </section>

      <nav className="flex flex-wrap items-center justify-center gap-4 pb-8 text-sm font-medium">
        <Link
          href="/contact"
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-white transition hover:bg-neutral-700"
        >
          {t('rules.contactCta')}
        </Link>
        <Link
          href="/welcome"
          className="rounded-full border border-neutral-300 px-5 py-2.5 text-neutral-900 transition hover:bg-neutral-50"
        >
          {t('rules.forumCta')}
        </Link>
      </nav>
    </article>
  );
}
