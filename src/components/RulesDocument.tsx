import Link from 'next/link';
import { Fragment, type ReactElement } from 'react';
import type { MessageKey, Messages } from '@/lib/messages';
import { RULES_CHAPTER_IDS, type RulesChapterId } from '@/lib/rules-chapters';
import { translate } from '@/lib/translate';

/** Props for {@link RulesDocument}. */
export interface RulesDocumentProps {
  /** Catalog for the negotiated request locale. */
  messages: Messages;
  /**
   * When true (default), show the public Contact / forum nav. Set false on the
   * signed-in onboarding screen so agreement is the only continue action.
   * Ignored when `chapter` is set (never public nav).
   */
  showNav?: boolean;
  /** When set, render only this chapter. When omitted, render every chapter. */
  chapter?: RulesChapterId;
}

const WANTED = [
  'rules.wanted1',
  'rules.wanted2',
  'rules.wanted3',
  'rules.wanted4',
  'rules.wanted5',
  'rules.wanted6',
] as const;
const ALLOWED = [
  'rules.allowed1',
  'rules.allowed2',
  'rules.allowed3',
  'rules.allowed4',
  'rules.allowed5',
] as const;
const RATHER_NOT = [
  'rules.ratherNot1',
  'rules.ratherNot2',
  'rules.ratherNot3',
  'rules.ratherNot4',
  'rules.ratherNot5',
  'rules.ratherNot6',
  'rules.ratherNot7',
  'rules.ratherNot8',
] as const;
const FORBIDDEN_QUID = [
  'rules.forbiddenQuid1',
  'rules.forbiddenQuid2',
  'rules.forbiddenQuid3',
  'rules.forbiddenQuid4',
  'rules.forbiddenQuid5',
  'rules.forbiddenQuid6',
] as const;
const FORBIDDEN_DONOR = [
  'rules.forbiddenDonor1',
  'rules.forbiddenDonor2',
  'rules.forbiddenDonor3',
  'rules.forbiddenDonor4',
  'rules.forbiddenDonor5',
] as const;
const FORBIDDEN_OTHER = [
  'rules.forbiddenOther1',
  'rules.forbiddenOther2',
  'rules.forbiddenOther3',
  'rules.forbiddenOther4',
  'rules.forbiddenOther5',
] as const;

function renderChapter(id: RulesChapterId, t: (key: MessageKey) => string): ReactElement {
  switch (id) {
    case 'lead':
      return <p className="text-base leading-relaxed text-app-fg">{t('rules.lead')}</p>;
    case 'law1':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.law1Title')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.law1Body')}</p>
          <p className="text-sm font-medium leading-relaxed text-app-fg">{t('rules.law1Test')}</p>
        </section>
      );
    case 'law2':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.law2Title')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.law2Body')}</p>
          <p className="text-sm font-medium leading-relaxed text-app-fg">{t('rules.law2Test')}</p>
        </section>
      );
    case 'law3':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.law3Title')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.law3Body')}</p>
        </section>
      );
    case 'wanted':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.wantedHeading')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.wantedLead')}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
            {WANTED.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      );
    case 'allowed':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.allowedHeading')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.allowedLead')}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
            {ALLOWED.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      );
    case 'ratherNot':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.ratherNotHeading')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.ratherNotLead')}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
            {RATHER_NOT.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </section>
      );
    case 'forbidden':
      return (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.forbiddenHeading')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.forbiddenLead')}</p>

          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {t('rules.forbiddenQuidHeading')}
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
              {FORBIDDEN_QUID.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {t('rules.forbiddenDonorHeading')}
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
              {FORBIDDEN_DONOR.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold tracking-tight">
              {t('rules.forbiddenOtherHeading')}
            </h3>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-app-fg">
              {FORBIDDEN_OTHER.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
        </section>
      );
    case 'house':
      return (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{t('rules.houseHeading')}</h2>
          <p className="text-sm leading-relaxed text-app-fg">{t('rules.houseBody')}</p>
        </section>
      );
  }
}

/**
 * Presentational living-room rules body: lead, three laws, wanted / allowed /
 * rather-not / forbidden lists, house right, and optional CTAs to `/contact`
 * and `/welcome`.
 *
 * Server component — copy comes from {@link translate} + the request catalog.
 * Pass `chapter` to render a single onboarding page.
 *
 * @param props - Locale catalog, optional public nav, optional single chapter.
 * @returns The rules document, or one chapter of it.
 */
export function RulesDocument({
  messages,
  showNav = true,
  chapter,
}: RulesDocumentProps): ReactElement {
  const t = (key: MessageKey): string => translate(messages, key);
  const nav =
    chapter === undefined && showNav ? (
      <nav className="flex flex-wrap items-center justify-center gap-4 pb-8 text-sm font-medium">
        <Link
          href="/contact"
          className="rounded-full bg-app-btn px-5 py-2.5 text-app-btn-fg transition hover:bg-app-btn-hover"
        >
          {t('rules.contactCta')}
        </Link>
        <Link
          href="/welcome"
          className="rounded-full border border-app-border-strong px-5 py-2.5 text-app-fg transition hover:bg-app-hover"
        >
          {t('rules.forumCta')}
        </Link>
      </nav>
    ) : null;

  return (
    <article className="flex w-full max-w-3xl flex-col gap-10 text-app-fg">
      {chapter !== undefined
        ? renderChapter(chapter, t)
        : RULES_CHAPTER_IDS.map((id) => <Fragment key={id}>{renderChapter(id, t)}</Fragment>)}
      {nav}
    </article>
  );
}
