'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { FondDeposit } from '@/components/FondDeposit';
import { ForumRoleHint, ForumRoleTag } from '@/components/ForumRoleTag';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Button, Card } from '@/components/ui';
import { useSpotRate } from '@/hooks/useSpotRate';
import { fetchFondSummary } from '@/lib/api';
import type { FondSummary } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import type { NumberFormatStyle } from '@/lib/number-format';
import type { FiatCode, FiatRateDay } from '@/lib/stats-money';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';

/**
 * Current-spot fiat line under a ₿ amount, or `null` without a usable rate.
 *
 * The spot is read for display only; it is never written onto an amount.
 *
 * @param sats - Whole sats shown in ₿.
 * @param rateDay - Current spot rate, or `null`.
 * @param fiat - Visitor's preferred fiat.
 * @param numberFormat - Grouping style.
 * @returns The fiat line element, or `null`.
 */
function FiatLine({
  sats,
  rateDay,
  fiat,
  numberFormat,
}: {
  sats: number;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  numberFormat: NumberFormatStyle;
}): ReactElement | null {
  const amount = satsToFiatAmount(sats, rateDay, fiat);
  if (amount === null) {
    return null;
  }
  return (
    <span className="mt-1 block text-sm font-normal text-app-muted">
      {formatFiatDisplay(amount, fiat, numberFormat)}
    </span>
  );
}

/**
 * Client loader for `/fonds/[username]`.
 *
 * Fetches the public totals from the same-origin `GET /fonds/:username/summary`
 * proxy. A 404 (no Fond, or another handle) shows the not-found sentence; any
 * other failure shows the retry row. The ready card shows the handle with the
 * existing Fond role pill, three KPI tiles in the `StatsDashboard` card style
 * (₿ over the visitor's preferred fiat from the current spot; the spot is
 * read, never written), the {@link FondDeposit} block, and the paid
 * grant-payout line with the stored USD figure from the api.
 *
 * A new component rather than `StatsDashboard`, which is the ink marketing
 * stats page with charts and a fiat picker, and rather than
 * `ViewProfileScreen`, which renders a member profile and gift charts.
 *
 * @param props - Fond handle from the route (e.g. `tondo-fond`).
 * @returns Loading, missing, error, or the Fond totals card.
 */
export function FondSummaryLoader({ username }: { username: string }): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const [status, setStatus] = useState<'loading' | 'missing' | 'error' | 'ready'>('loading');
  const [summary, setSummary] = useState<FondSummary | null>(null);
  const [roleHintOpen, setRoleHintOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setSummary(null);
    setRoleHintOpen(false);

    void (async () => {
      try {
        const next = await fetchFondSummary(username);
        if (cancelled) {
          return;
        }
        if (next === null) {
          setStatus('missing');
          return;
        }
        setSummary(next);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username, attempt]);

  if (status === 'loading') {
    return <p className="text-center text-sm text-app-muted">{t('forum.loading')}</p>;
  }

  if (status === 'missing') {
    return <p className="text-center text-sm text-app-muted">{t('fond.missing')}</p>;
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('fond.error')}
        </p>
        <Button
          type="button"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('view.retry')}
        </Button>
      </div>
    );
  }

  const ready = summary as FondSummary;
  const balanceAsOf =
    ready.balanceSyncedAt === null
      ? t('fond.balanceNotReported')
      : t('fond.balanceAsOf', { date: formatForumTime(ready.balanceSyncedAt, locale) });

  return (
    <Card maxWidth="xl" surface={false}>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
            {ready.username}
          </h1>
          <ForumRoleTag
            role="fond"
            expanded={roleHintOpen}
            onToggle={() => {
              setRoleHintOpen((open) => !open);
            }}
          />
        </div>
        {roleHintOpen ? (
          <p role="status" className="text-center text-xs text-app-muted">
            <ForumRoleHint role="fond" />
          </p>
        ) : null}
      </div>
      <dl className="grid w-full gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-app-border p-5">
          <dt className="text-sm text-app-muted">{t('fond.received')}</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatBitcoin(ready.receivedSats, numberFormat)}
            <FiatLine
              sats={ready.receivedSats}
              rateDay={rateDay}
              fiat={fiat}
              numberFormat={numberFormat}
            />
          </dd>
        </div>
        <div className="rounded-2xl border border-app-border p-5">
          <dt className="text-sm text-app-muted">{t('fond.paidOut')}</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {formatBitcoin(ready.paidOutSats, numberFormat)}
            <FiatLine
              sats={ready.paidOutSats}
              rateDay={rateDay}
              fiat={fiat}
              numberFormat={numberFormat}
            />
            <span className="mt-1 block text-sm font-normal text-app-muted">
              {t('fond.fees')} {formatBitcoin(ready.feesSats, numberFormat)}
            </span>
            <FiatLine
              sats={ready.feesSats}
              rateDay={rateDay}
              fiat={fiat}
              numberFormat={numberFormat}
            />
          </dd>
        </div>
        <div className="rounded-2xl border border-app-border p-5">
          <dt className="text-sm text-app-muted">{t('fond.balance')}</dt>
          <dd className="mt-2 text-2xl font-semibold tabular-nums lining-nums">
            {ready.balanceSats === null ? '\u2014' : formatBitcoin(ready.balanceSats, numberFormat)}
            {ready.balanceSats === null ? null : (
              <FiatLine
                sats={ready.balanceSats}
                rateDay={rateDay}
                fiat={fiat}
                numberFormat={numberFormat}
              />
            )}
            <span className="mt-1 block text-sm font-normal text-app-muted">{balanceAsOf}</span>
          </dd>
        </div>
      </dl>
      <FondDeposit username={ready.username} onchainAddress={ready.onchainAddress} />
      <p className="text-center text-sm text-app-muted">
        {t('fond.payoutsPaid', { count: ready.payoutsPaid, usd: `${ready.payoutsPaidUsd} USD` })}
      </p>
    </Card>
  );
}
