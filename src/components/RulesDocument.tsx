import { Check, Minus, X } from 'lucide-react';
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

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** Glyph in front of every list item; `tone` picks the colour of the glyph. */
type ListTone = 'welcome' | 'allowed' | 'ratherNot' | 'forbidden';

const WANTED = [
  'rules.wanted1',
  'rules.wanted2',
  'rules.wanted3',
  'rules.wanted4',
  'rules.wanted5',
  'rules.wanted6',
  'rules.wanted7',
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
  'rules.ratherNot9',
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

const LIST_GLYPH: Record<ListTone, { Icon: typeof Check; className: string }> = {
  welcome: { Icon: Check, className: 'text-app-accent' },
  allowed: { Icon: Check, className: 'text-app-muted' },
  ratherNot: { Icon: Minus, className: 'text-app-muted' },
  forbidden: { Icon: X, className: 'text-red-600' },
};

const HEADING = 'text-2xl font-semibold tracking-tight text-app-fg';
const LEAD = 'text-base leading-relaxed text-app-muted';
const BODY = 'text-base leading-relaxed text-app-fg';
const CARD = 'rounded-2xl border border-app-border bg-app-card';
const KICKER = 'text-xs font-semibold uppercase tracking-[0.2em]';

function RuleList({
  items,
  tone,
  t,
}: {
  items: readonly MessageKey[];
  tone: ListTone;
  t: Translate;
}): ReactElement {
  const { Icon, className } = LIST_GLYPH[tone];
  return (
    <ul className={`${CARD} divide-y divide-app-border`}>
      {items.map((key) => (
        <li key={key} className="flex items-start gap-3 px-5 py-3.5 text-sm leading-relaxed">
          <Icon aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 ${className}`} />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

function TestCallout({ text, t }: { text: string; t: Translate }): ReactElement {
  return (
    <div className="rounded-xl bg-app-card-muted px-5 py-4">
      <p className={`${KICKER} text-app-muted`}>{t('rules.testLabel')}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-app-fg">{text}</p>
    </div>
  );
}

function Law({
  n,
  title,
  body,
  test,
  t,
}: {
  n: number;
  title: string;
  body: string;
  test?: string;
  t: Translate;
}): ReactElement {
  return (
    <section className={`${CARD} flex flex-col gap-4 p-6 sm:p-8`}>
      <p className={`${KICKER} text-app-accent`}>{t('rules.lawKicker', { n })}</p>
      <h2 className={HEADING}>{title}</h2>
      <p className={BODY}>{body}</p>
      {test === undefined ? null : <TestCallout text={test} t={t} />}
    </section>
  );
}

function ListChapter({
  heading,
  lead,
  items,
  tone,
  t,
}: {
  heading: string;
  lead: string;
  items: readonly MessageKey[];
  tone: ListTone;
  t: Translate;
}): ReactElement {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h2 className={HEADING}>{heading}</h2>
        <p className={LEAD}>{lead}</p>
      </header>
      <RuleList items={items} tone={tone} t={t} />
    </section>
  );
}

function renderChapter(id: RulesChapterId, t: Translate): ReactElement {
  switch (id) {
    case 'lead':
      return (
        <section className="flex flex-col gap-5">
          <p className="text-lg leading-relaxed text-app-fg">{t('rules.lead')}</p>
          <div className="border-l-2 border-app-accent pl-5">
            <p className={`${KICKER} text-app-muted`}>{t('rules.testLabel')}</p>
            <p className="mt-1.5 text-base leading-relaxed text-app-fg">{t('rules.leadTest')}</p>
          </div>
        </section>
      );
    case 'law1':
      return (
        <Law
          n={1}
          title={t('rules.law1Title')}
          body={t('rules.law1Body')}
          test={t('rules.law1Test')}
          t={t}
        />
      );
    case 'law2':
      return (
        <Law
          n={2}
          title={t('rules.law2Title')}
          body={t('rules.law2Body')}
          test={t('rules.law2Test')}
          t={t}
        />
      );
    case 'law3':
      return <Law n={3} title={t('rules.law3Title')} body={t('rules.law3Body')} t={t} />;
    case 'wanted':
      return (
        <ListChapter
          heading={t('rules.wantedHeading')}
          lead={t('rules.wantedLead')}
          items={WANTED}
          tone="welcome"
          t={t}
        />
      );
    case 'allowed':
      return (
        <ListChapter
          heading={t('rules.allowedHeading')}
          lead={t('rules.allowedLead')}
          items={ALLOWED}
          tone="allowed"
          t={t}
        />
      );
    case 'ratherNot':
      return (
        <ListChapter
          heading={t('rules.ratherNotHeading')}
          lead={t('rules.ratherNotLead')}
          items={RATHER_NOT}
          tone="ratherNot"
          t={t}
        />
      );
    case 'forbidden':
      return (
        <section className="flex flex-col gap-6">
          <header className="flex flex-col gap-1.5">
            <h2 className={HEADING}>{t('rules.forbiddenHeading')}</h2>
            <p className={LEAD}>{t('rules.forbiddenLead')}</p>
          </header>
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold tracking-tight text-app-fg">
              {t('rules.forbiddenQuidHeading')}
            </h3>
            <RuleList items={FORBIDDEN_QUID} tone="forbidden" t={t} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold tracking-tight text-app-fg">
              {t('rules.forbiddenDonorHeading')}
            </h3>
            <RuleList items={FORBIDDEN_DONOR} tone="forbidden" t={t} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold tracking-tight text-app-fg">
              {t('rules.forbiddenOtherHeading')}
            </h3>
            <RuleList items={FORBIDDEN_OTHER} tone="forbidden" t={t} />
          </div>
        </section>
      );
    case 'house':
      return (
        <section className="flex flex-col gap-4 rounded-2xl bg-app-card-muted p-6 sm:p-8">
          <h2 className={HEADING}>{t('rules.houseHeading')}</h2>
          <p className={BODY}>{t('rules.houseBody')}</p>
          <p className="text-base font-medium leading-relaxed text-app-fg">
            {t('rules.houseClosing')}
          </p>
        </section>
      );
  }
}

/**
 * Presentational living-room rules body: lead with the sofa test, three rule
 * cards (test callout on rules 1 and 2), welcome / allowed / better-not /
 * forbidden lists with glyphs, the closing "Our house" block, and optional
 * CTAs to `/contact` and `/welcome`.
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
  const t: Translate = (key, vars) => translate(messages, key, vars);
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
