'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { fetchFundingApplications } from '@/lib/api';
import type { FundingApplication } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Display name for an applicant, or the unnamed fallback.
 *
 * @param name - Api display name, which may be null or empty.
 * @param unnamed - Localized unnamed copy.
 * @returns A non-empty label.
 */
function personLabel(name: string | null, unnamed: string): string {
  return name !== null && name !== '' ? name : unnamed;
}

/**
 * Signed-in staff queue of open 21 gifts grant applications.
 *
 * Founders and moderators see one list of pending applications (oldest first).
 * Other signed-in visitors see a short forbidden message and no list. Fetches
 * {@link fetchFundingApplications} only. Renders nothing without a session.
 * In-card back goes to the moderation hub.
 *
 * @returns The applications card, forbidden copy, or `null` without a session.
 */
export function FundingApplicationsScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [applications, setApplications] = useState<FundingApplication[] | null>(null);
  const [applicationsError, setApplicationsError] = useState(false);
  const [applicationsAttempt, setApplicationsAttempt] = useState(0);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setApplicationsError(false);
    void (async () => {
      try {
        const next = await fetchFundingApplications(session);
        if (cancelled) {
          return;
        }
        setApplications(next);
      } catch {
        if (cancelled) {
          return;
        }
        setApplications(null);
        setApplicationsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, applicationsAttempt]);

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
          {t('funding.applications.heading')}
        </h1>
      </div>
    </div>
  );

  if (!staff) {
    return (
      <Card maxWidth="xl">
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  const unnamed = t('moderate.unnamed');

  let body: ReactElement;
  if (applicationsError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.applications.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setApplicationsAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (applications === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (applications.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('funding.applications.empty')}</p>;
  } else {
    body = (
      <ul aria-label={t('funding.applications.listLabel')} className="flex w-full flex-col gap-3">
        {applications.map((row) => {
          const name = personLabel(row.name, unnamed);
          return (
            <li key={row.accountId}>
              <div className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
                <span className="flex w-full items-baseline justify-between gap-2">
                  <Link
                    href={`/moderate/applications/${row.accountId}`}
                    className="text-sm font-medium text-app-fg underline underline-offset-2"
                  >
                    {name}
                  </Link>
                  <time
                    dateTime={new Date(row.appliedAt).toISOString()}
                    className="text-xs text-app-subtle"
                  >
                    {formatForumTimeFromMs(row.appliedAt, locale)}
                  </time>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card maxWidth="xl">
      {heading}
      <p className="text-center text-sm text-app-muted">{t('funding.applications.lead')}</p>
      {body}
    </Card>
  );
}
