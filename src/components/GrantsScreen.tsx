'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { FundingStatusCard } from '@/components/FundingStatusCard';
import { GrantPlacesPanel } from '@/components/GrantPlacesPanel';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, ButtonLink, Card } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import { fetchFundingApplications } from '@/lib/api';
import type { OwnerFunding } from '@/lib/api-types';
import { requestForumCompose } from '@/lib/forum-feed';
import { refreshOwnerAccount } from '@/lib/owner-account-refresh';
import { canEditDailyPayoutRoster, roleAtLeast } from '@/lib/roles';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Shop payments today and yesterday together, and the sum they must reach. */
interface ShopPaymentProgress {
  /** Whole sats paid in 21.gifts shops on the payout UTC day and the day before. */
  paidSats: number;
  /** Whole sats those payments must reach: half the daily grant, rounded up. */
  requiredSats: number;
}

/**
 * The shop amounts behind a `shop_payment` block, when the api sent both.
 *
 * @param funding - The owner funding object, or `null`/`undefined` without one.
 * @returns Paid and required sats while today's payout is blocked by the shop
 *   payment and both numbers are known, otherwise `null`.
 */
function shopPaymentProgress(funding: OwnerFunding | null | undefined): ShopPaymentProgress | null {
  if (funding === null || funding === undefined) {
    return null;
  }
  const payout = funding.payoutToday;
  if (payout?.state !== 'blocked' || payout.reason !== 'shop_payment') {
    return null;
  }
  const paidSats = funding.shopPaymentSats ?? null;
  const requiredSats = funding.shopPaymentRequiredSats ?? null;
  if (paidSats === null || requiredSats === null) {
    return null;
  }
  return { paidSats, requiredSats };
}

/**
 * Signed-in grants page: the owner grant card, the public grant places
 * ({@link GrantPlacesPanel}, loaded again whenever the owner's grant status
 * changes, so a place freed by leaving the grant shows at once), the continuation-goals link,
 * the daily-payment text and amounts links, plus the staff queue for moderators.
 *
 * Renders nothing without a session. A signed-in account sees a secondary link
 * to `/grants/goals` under the grant card. A viewer at least initiator
 * (initiator and founder) also sees three secondary links, to the daily
 * payment text, the amounts, and the moderator payments.
 * Those links do not fetch the daily roster. A missing account shows neither
 * the goals link nor those payment links. While today's payout is blocked by
 * the shop payment and the api sent both shop amounts, the payout line names
 * the sum to spend in shops today and yesterday together (half the daily
 * grant), what was spent so far, and what is still missing (never below
 * zero), each as bitcoin with the current spot in the visitor's currency
 * beside it while a spot is available. Without both amounts it names half
 * the daily grant without a figure. Accounts at least moderator,
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
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const shopProgress = shopPaymentProgress(account?.funding);
  const rateDay = useSpotRate(shopProgress !== null);

  useEffect(() => {
    if (session === null) {
      return;
    }
    refreshOwnerAccount(session);
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
    | 'funding.payoutToday.shopPaymentAmount'
    | 'funding.payoutToday.mediaPost'
    | 'funding.payoutToday.unavailable' = 'funding.payoutToday.unavailable';
  let payoutHref: string | null = null;
  let payoutVars: Record<string, string> | undefined;
  let payoutNote: string | null = null;
  let opensComposer = false;
  const money = (sats: number): string => {
    const bitcoin = formatBitcoin(sats, numberFormat);
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null
      ? bitcoin
      : `${bitcoin} · ${formatFiatDisplay(amount, fiat, numberFormat)}`;
  };
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
      payoutHref = '/shops';
      if (shopProgress === null) {
        payoutKey = 'funding.payoutToday.shopPayment';
      } else {
        payoutKey = 'funding.payoutToday.shopPaymentAmount';
        payoutVars = { required: money(shopProgress.requiredSats) };
        payoutNote = t('funding.payoutToday.shopPaymentProgress', {
          paid: money(shopProgress.paidSats),
          missing: money(Math.max(0, shopProgress.requiredSats - shopProgress.paidSats)),
        });
      }
    } else if (payoutToday.reason === 'media_post') {
      payoutKey = 'funding.payoutToday.mediaPost';
      payoutHref = '/welcome';
      opensComposer = true;
    }
  }

  const payoutLine = t(payoutKey, payoutVars);
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
        <p className="text-center text-sm text-app-muted">
          {payoutContent}
          {payoutNote === null ? null : ` ${payoutNote}`}
        </p>
      </div>
      <GrantPlacesPanel reloadKey={account?.funding?.status ?? 'none'} />
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
