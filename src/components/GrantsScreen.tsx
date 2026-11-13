'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import { GrantPlacesPanel } from '@/components/GrantPlacesPanel';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, ButtonLink, Card } from '@/components/ui';
import { fetchFundingApplications } from '@/lib/api';
import { requestForumCompose } from '@/lib/forum-feed';
import { refreshOwnerAccount } from '@/lib/owner-account-refresh';
import { canEditDailyPayoutRoster, roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in grants page: the owner grant card, the public grant places
 * ({@link GrantPlacesPanel}), the continuation-goals link,
 * the daily-payment text and amounts links, plus the staff queue for moderators.
 *
 * Renders nothing without a session. A signed-in account sees a secondary link
 * to `/grants/goals` under the grant card. A viewer at least initiator
 * (initiator and founder) also sees three secondary links, to the daily
 * payment text, the amounts, and the moderator payments.
 * Those links do not fetch the daily roster. A missing account shows neither
 * the goals link nor those payment links. Accounts at least moderator,
 * including a fond, an initiator, and a founder, see how many open grant applications
 * exist. When the count is greater than zero, a secondary link to
 * `/grants/applications` shows that count. When the count is zero, that
 * control is the empty sentence as plain text. Members below moderator never
 * see the queue and never trigger that fetch.
 *
 * @returns The grants card, or `null` without a session.
 */
export function GrantsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = session !== null && roleAtLeast(account?.role, 'moderator');
  const editor = canEditDailyPayoutRoster(account?.role);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [applicationsError, setApplicationsError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let mounted = true;
    refreshOwnerAccount(session, () => mounted);
    return () => {
      mounted = false;
    };
  }, [session]);

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
        setOpenCount(next.length);
      } catch {
        if (cancelled) {
          return;
        }
        setOpenCount(null);
        setApplicationsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, staff, attempt]);

  if (session === null) {
    return null;
  }

  const payoutToday =
    account?.funding !== null && account?.funding !== undefined
      ? (account.funding.payoutToday ?? null)
      : (account?.grantPayoutToday ?? null);
  let payoutKey:
    | 'funding.payoutToday.paid'
    | 'funding.payoutToday.welcome'
    | 'funding.payoutToday.due'
    | 'funding.payoutToday.paused'
    | 'funding.payoutToday.verify'
    | 'funding.payoutToday.admission'
    | 'funding.payoutToday.admissionPending'
    | 'funding.payoutToday.wallet'
    | 'funding.payoutToday.recoveryShare'
    | 'funding.payoutToday.shopPayment'
    | 'funding.payoutToday.mediaPost'
    | 'funding.payoutToday.unavailable' = 'funding.payoutToday.unavailable';
  let payoutHref: string | null = null;
  let opensComposer = false;
  if (payoutToday?.state === 'paid' && payoutToday.reason === null) {
    payoutKey = 'funding.payoutToday.paid';
  } else if (payoutToday?.state === 'paid' && payoutToday.reason === 'welcome') {
    payoutKey = 'funding.payoutToday.welcome';
  } else if (payoutToday?.state === 'due' && payoutToday.reason === null) {
    payoutKey = 'funding.payoutToday.due';
  } else if (payoutToday?.state === 'due' && payoutToday.reason === 'payments_paused') {
    payoutKey = 'funding.payoutToday.paused';
  } else if (payoutToday?.state === 'blocked') {
    if (payoutToday.reason === 'verify') {
      payoutKey = 'funding.payoutToday.verify';
      payoutHref = '/trust-chain';
    } else if (payoutToday.reason === 'admission') {
      if (account?.funding?.status === 'pending') {
        payoutKey = 'funding.payoutToday.admissionPending';
      } else {
        payoutKey = 'funding.payoutToday.admission';
        if (account?.funding?.status === 'none' || account?.funding?.status === 'rejected') {
          payoutHref = '/grants/apply';
        }
      }
    } else if (payoutToday.reason === 'wallet') {
      payoutKey = 'funding.payoutToday.wallet';
      payoutHref = '/wallet';
    } else if (payoutToday.reason === 'recovery_share') {
      payoutKey = 'funding.payoutToday.recoveryShare';
      payoutHref = '/settings/social-recovery';
    } else if (payoutToday.reason === 'shop_payment') {
      payoutKey = 'funding.payoutToday.shopPayment';
      payoutHref = '/shops';
    } else if (payoutToday.reason === 'media_post') {
      payoutKey = 'funding.payoutToday.mediaPost';
      payoutHref = '/welcome';
      opensComposer = true;
    }
  }

  const payoutLine = t(payoutKey);
  const payoutContent =
    payoutHref === null ? (
      payoutLine
    ) : (
      <Link
        href={payoutHref}
        className="text-app-fg underline underline-offset-2"
        {...(opensComposer ? { onClick: requestForumCompose } : {})}
      >
        {payoutLine}
      </Link>
    );

  let queue: ReactElement | null = null;
  if (staff) {
    if (applicationsError) {
      queue = (
        <>
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('funding.applications.error')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            {t('moderate.retry')}
          </Button>
        </>
      );
    } else if (openCount === null) {
      queue = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
    } else if (openCount === 0) {
      queue = (
        <p className="text-center text-sm text-app-muted">{t('funding.applications.empty')}</p>
      );
    } else {
      queue = (
        <ButtonLink href="/grants/applications" variant="secondary" size="lg">
          {t('funding.applications.openCount', { count: openCount })}
        </ButtonLink>
      );
    }
  }

  return (
    <Card surface={false}>
      <FundingStatusCard />
      <div
        role="group"
        aria-labelledby="funding-payout-today-heading"
        className="flex w-full flex-col gap-2 rounded-3xl border border-app-border-strong bg-app-card-muted p-4"
      >
        <h2
          id="funding-payout-today-heading"
          className="text-center text-base font-semibold text-app-fg"
        >
          {t('funding.payoutToday.heading')}
        </h2>
        <p className="text-center text-sm text-app-muted">{payoutContent}</p>
      </div>
      <GrantPlacesPanel />
      {account !== null ? (
        <ButtonLink href="/grants/goals" variant="secondary" size="lg">
          {t('funding.goals.link')}
        </ButtonLink>
      ) : null}
      {editor ? (
        <>
          <ButtonLink href="/grants/payments/comment" variant="secondary" size="lg">
            {t('funding.daily.commentLink')}
          </ButtonLink>
          <ButtonLink href="/grants/payments/amounts" variant="secondary" size="lg">
            {t('funding.daily.amountsLink')}
          </ButtonLink>
          <ButtonLink href="/grants/payments/moderators" variant="secondary" size="lg">
            {t('funding.daily.moderatorsLink')}
          </ButtonLink>
        </>
      ) : null}
      {queue}
    </Card>
  );
}
