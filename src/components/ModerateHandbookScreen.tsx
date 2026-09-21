'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

const CHAPTER_IDS = ['login', 'verified', 'funding'] as const;

type ChapterId = (typeof CHAPTER_IDS)[number];

/**
 * Permalink heading row for one staff handbook chapter.
 *
 * @param props - DOM id and already-translated title.
 * @returns The heading plus copy-link control.
 */
function ChapterHeading({ id, title }: { id: ChapterId; title: string }): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <h2 id={id} className="scroll-mt-24 text-xl font-semibold text-app-fg">
        <a
          href={`#${id}`}
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-fg"
        >
          {title}
        </a>
      </h2>
      <HandbookCopyLink targetId={id} label={title} tone="app" />
    </div>
  );
}

/**
 * Chapter id from `location.hash` when it is a handbook chapter.
 *
 * @returns `login`, `verified`, or `funding`, otherwise `null`.
 */
function hashChapterId(): ChapterId | null {
  const raw = window.location.hash.slice(1);
  for (const id of CHAPTER_IDS) {
    if (id === raw) {
      return id;
    }
  }
  return null;
}

/**
 * Signed-in staff handbook of how 21.gifts works.
 *
 * Moderators see a table of contents and three chapters (login, verified,
 * official funding), each with a permalink and copy-link. Other signed-in
 * visitors see a short forbidden message and no chapters. Renders nothing
 * without a session. In-card back goes to the moderation hub. No network.
 *
 * @returns The handbook card, forbidden copy, or `null` without a session.
 */
export function ModerateHandbookScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');

  useEffect(() => {
    const scrollIfMatch = (): void => {
      const id = hashChapterId();
      if (id !== null) {
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      }
    };
    scrollIfMatch();
    window.addEventListener('hashchange', scrollIfMatch);
    return () => {
      window.removeEventListener('hashchange', scrollIfMatch);
    };
  }, []);

  if (session === null) {
    return null;
  }

  const heading = (
    <div className="flex w-full items-center gap-2">
      <Link
        href="/moderate"
        aria-label={t('moderate.heading')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('moderate.handbook.heading')}
        </h1>
      </div>
    </div>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  const loginTitle = t('moderate.handbook.login.title');
  const verifiedTitle = t('moderate.handbook.verified.title');
  const fundingTitle = t('moderate.handbook.funding.title');
  const chapters: { id: ChapterId; title: string }[] = [
    { id: 'login', title: loginTitle },
    { id: 'verified', title: verifiedTitle },
    { id: 'funding', title: fundingTitle },
  ];

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      <nav aria-label={t('moderate.handbook.tocLabel')} className="w-full">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-app-fg">
          {chapters.map((chapter) => (
            <li key={chapter.id}>
              <a href={`#${chapter.id}`}>{chapter.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <section className="flex w-full flex-col gap-3">
        <ChapterHeading id="login" title={loginTitle} />
        <p className="text-sm text-app-fg">{t('moderate.handbook.login.body')}</p>
      </section>
      <section className="flex w-full flex-col gap-3">
        <ChapterHeading id="verified" title={verifiedTitle} />
        <p className="text-sm text-app-fg">{t('moderate.handbook.verified.body1')}</p>
        <p className="text-sm text-app-fg">{t('moderate.handbook.verified.body2')}</p>
        <p className="text-sm text-app-fg">{t('moderate.handbook.verified.body3')}</p>
      </section>
      <section className="flex w-full flex-col gap-3">
        <ChapterHeading id="funding" title={fundingTitle} />
        <p className="text-sm text-app-fg">{t('moderate.handbook.funding.body')}</p>
        <p className="text-sm text-app-fg">{t('moderate.handbook.funding.rulesLead')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-app-fg">
          <li>{t('moderate.handbook.funding.rulePrinciples')}</li>
          <li>{t('moderate.handbook.funding.ruleDaily')}</li>
          <li>{t('moderate.handbook.funding.ruleRecord')}</li>
          <li>{t('moderate.handbook.funding.ruleCap')}</li>
        </ul>
        <p className="text-sm text-app-fg">{t('moderate.handbook.funding.principlesLead')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-app-fg">
          <li>{t('about.conv1Title')}</li>
          <li>{t('about.conv2Title')}</li>
          <li>{t('about.conv3Title')}</li>
        </ul>
      </section>
    </Card>
  );
}
