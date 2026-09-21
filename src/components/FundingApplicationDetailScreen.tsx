'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import {
  fetchFundingApplication,
  postFundingAdmit,
  postFundingReject,
  postFundingTrial,
} from '@/lib/api';
import type { FundingApplicationDetail } from '@/lib/api-types';
import { formatForumTime, formatForumTimeFromMs } from '@/lib/forum-time';
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
 * Signed-in staff review of one 21 gifts grant application.
 *
 * Founders and moderators see the applicant, living-room posts, the three
 * convictions as criteria, and status-gated Trial / Admit / Reject (Trial only
 * when `grant.status` is `pending`; Admit and Reject when `pending` or
 * `trial`). Other signed-in visitors see a short forbidden message and no
 * fetch. Renders nothing without a session. In-card back goes to the
 * open-applications queue. A failed decision shows `trustChain.actionFailed`.
 * A successful decision leaves the buttons disabled until unmount.
 *
 * @param props - Dynamic route `accountId`.
 * @returns The detail card, forbidden copy, or `null` without a session.
 */
export function FundingApplicationDetailScreen({
  accountId,
}: {
  accountId: string;
}): ReactElement | null {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [detail, setDetail] = useState<FundingApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [detailAttempt, setDetailAttempt] = useState(0);
  const [deciding, setDeciding] = useState(false);
  const [decideFailed, setDecideFailed] = useState(false);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setDetailError(false);
    setDecideFailed(false);
    void (async () => {
      try {
        const next = await fetchFundingApplication(session, accountId);
        if (cancelled) {
          return;
        }
        setDetail(next);
      } catch {
        if (cancelled) {
          return;
        }
        setDetail(null);
        setDetailError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, accountId, detailAttempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <div className="flex w-full items-center gap-2">
      <Link
        href="/moderate/applications"
        aria-label={t('funding.applications.heading')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
          {t('funding.detail.heading')}
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

  const decide = (kind: 'trial' | 'admit' | 'reject'): void => {
    /* v8 ignore next 3 — the action buttons are disabled while busy */
    if (deciding) {
      return;
    }
    setDeciding(true);
    setDecideFailed(false);
    const run =
      kind === 'trial' ? postFundingTrial : kind === 'admit' ? postFundingAdmit : postFundingReject;
    void (async () => {
      try {
        await run(session, accountId);
        router.push('/moderate/applications');
      } catch {
        setDecideFailed(true);
        setDeciding(false);
      }
    })();
  };

  let body: ReactElement;
  if (detailError) {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('funding.detail.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDetailAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (detail === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else {
    const unnamed = t('moderate.unnamed');
    const name = personLabel(detail.account.name, unnamed);
    body = (
      <>
        <p className="text-center text-sm font-medium text-app-fg">
          <Link href={`/members/${detail.account.id}`} className="underline underline-offset-2">
            {name}
          </Link>
        </p>
        <p className="text-center text-xs text-app-subtle">
          {formatForumTimeFromMs(detail.grant.appliedAt, locale)}
        </p>
        <p className="text-center text-sm text-app-muted">{t('funding.detail.criteria')}</p>
        <ul className="flex w-full flex-col gap-1">
          <li className="text-center text-sm text-app-fg">{t('about.conv1Title')}</li>
          <li className="text-center text-sm text-app-fg">{t('about.conv2Title')}</li>
          <li className="text-center text-sm text-app-fg">{t('about.conv3Title')}</li>
        </ul>
        <Link
          href="/about"
          className="text-center text-sm text-app-fg underline underline-offset-2"
        >
          {t('nav.about')}
        </Link>
        {detail.messages.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('funding.detail.emptyPosts')}</p>
        ) : (
          <ul aria-label={t('funding.detail.postsLabel')} className="flex w-full flex-col gap-3">
            {detail.messages.map((row) => (
              <li key={row.id}>
                <div className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-app-fg">{row.name}</span>
                    <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                      {formatForumTime(row.createdAt, locale)}
                    </time>
                  </span>
                  {row.text !== '' ? (
                    <span className="text-sm text-app-muted">{row.text}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {decideFailed ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('trustChain.actionFailed')}
          </p>
        ) : null}
        {detail.grant.status === 'pending' || detail.grant.status === 'trial' ? (
          <div className="flex w-full flex-col items-stretch gap-3">
            {detail.grant.status === 'pending' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={deciding}
                icon={
                  deciding ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
                onClick={() => {
                  decide('trial');
                }}
              >
                {t('funding.detail.trial')}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={deciding}
              icon={
                deciding ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : undefined
              }
              onClick={() => {
                decide('admit');
              }}
            >
              {t('funding.detail.admit')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={deciding}
              icon={
                deciding ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : undefined
              }
              onClick={() => {
                decide('reject');
              }}
            >
              {t('funding.detail.reject')}
            </Button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}
