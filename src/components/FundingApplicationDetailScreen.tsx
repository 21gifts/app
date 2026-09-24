'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { TranslatableNoteBody } from '@/components/TranslatableNoteBody';
import { Button, Card } from '@/components/ui';
import { fetchFundingApplication, postFundingAdmit, postFundingReject } from '@/lib/api';
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

type ReviewStep = 1 | 2 | 3 | 4;

/**
 * Signed-in staff review of one 21 gifts grant application.
 *
 * Founders and moderators walk four steps: principles 1–3 against living-room
 * posts (no replies), then whether the posts are true to the reviewer's
 * knowledge. **Requirement met** advances; **Requirement not met** or **No**
 * posts reject. **Yes** on the last step posts admit. Other signed-in
 * visitors see forbidden copy and no fetch. Renders nothing without a
 * session. In-card back goes to the open-applications queue.
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
  const [step, setStep] = useState<ReviewStep>(1);
  const [deciding, setDeciding] = useState(false);
  const [decideFailed, setDecideFailed] = useState(false);

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    let cancelled = false;
    setDetailError(false);
    setDecideFailed(false);
    setStep(1);
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

  const finish = (kind: 'admit' | 'reject'): void => {
    /* v8 ignore next 3 — the action buttons are disabled while busy */
    if (deciding) {
      return;
    }
    setDeciding(true);
    setDecideFailed(false);
    const run = kind === 'admit' ? postFundingAdmit : postFundingReject;
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

  const onMet = (): void => {
    if (step === 4) {
      finish('admit');
      return;
    }
    setStep((step + 1) as ReviewStep);
  };

  const onUnmet = (): void => {
    finish('reject');
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
    const principle = step === 4 ? null : step;
    const open = detail.grant.status === 'pending' || detail.grant.status === 'trial';
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
        {principle === 1 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check1')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv1Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv1Body')}</p>
          </>
        ) : principle === 2 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check2')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv2Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv2Body')}</p>
          </>
        ) : principle === 3 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check3')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv3Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv3Body')}</p>
          </>
        ) : (
          <p className="text-center text-sm text-app-muted">{t('funding.review.truth')}</p>
        )}
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
                    <TranslatableNoteBody
                      messageId={row.id}
                      text={row.text}
                      truncate={false}
                      className="text-sm text-app-muted"
                    />
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
        {open ? (
          <div className="flex w-full flex-col items-stretch gap-3">
            <Button
              type="button"
              disabled={deciding}
              icon={
                deciding ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : undefined
              }
              onClick={onMet}
            >
              {step === 4 ? t('funding.review.yes') : t('funding.review.met')}
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
              onClick={onUnmet}
            >
              {step === 4 ? t('funding.review.no') : t('funding.review.unmet')}
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
