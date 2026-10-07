'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { useSpotRate } from '@/hooks/useSpotRate';
import { RepaymentPlanChart } from '@/components/RepaymentPlanChart';
import { getRepayment, type RepaymentLedger, type RepaymentLine } from '@/lib/api';
import type { MessageKey } from '@/lib/messages';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

/**
 * Who gave what on a credit, and who is paid back how much, when, and by one bitcoin payment.
 *
 * Renders nothing until the public ledger for this note loads. A failed read
 * stays blank. Changing `messageId` drops the previous note immediately, so a
 * slow read never keeps the last person's rows on screen.
 * `list="summary"` (default) shows givers, the explanation, the chart, and a
 * link to the repayment list. `list="page"` also shows the day-group rows and
 * omits that link.
 *
 * @param props - Credit note id and which list to render.
 * @returns The two lists, or null.
 */
export function CreditLedger({
  messageId,
  list = 'summary',
}: {
  messageId: string;
  list?: 'summary' | 'page';
}): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat: visitorFiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const [loaded, setLoaded] = useState<{
    messageId: string;
    ledger: RepaymentLedger;
  } | null>(null);
  const ledger = loaded !== null && loaded.messageId === messageId ? loaded.ledger : null;
  useEffect(() => {
    let cancel = false;
    void getRepayment(messageId).then((row) => {
      if (!cancel && row !== null) {
        setLoaded({ messageId, ledger: row });
      }
    });
    return () => {
      cancel = true;
    };
  }, [messageId]);
  useEffect(() => {
    if (ledger === null || !ledger.repayments.some((row) => row.status === 'due')) {
      return;
    }
    let cancel = false;
    const timer = setInterval(() => {
      void getRepayment(messageId).then((row) => {
        if (!cancel && row !== null) {
          setLoaded({ messageId, ledger: row });
        }
      });
    }, 4000);
    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [ledger, messageId]);
  if (ledger === null) {
    return null;
  }
  const fiat = ledger.currency === 'BTC' ? null : (ledger.currency as FiatCode);
  return (
    <div className="mt-3 rounded-xl bg-app-card-muted px-3 py-2.5">
      <section aria-label={t('forum.creditGiven')}>
        <h3 className="text-xs font-medium text-app-fg">{t('forum.creditGiven')}</h3>
        {ledger.givers.length === 0 ? (
          <p className="mt-2 text-sm text-app-fg">{t('forum.creditNoneYet')}</p>
        ) : (
          <ul className="mt-1">
            {ledger.givers.map((giver) => (
              <li
                key={giver.accountId}
                className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
              >
                <span className="min-w-0 truncate text-sm text-app-fg">
                  {giverLabel(giver.name, giver.username, giver.accountId)}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums text-app-fg">
                  {fiat !== null && giver.givenAmount !== null ? (
                    formatFiatDisplay(giver.givenAmount, fiat, numberFormat)
                  ) : (
                    <>
                      {formatBitcoin(giver.givenSats, numberFormat)}
                      {preferredFiatSuffix(giver.givenSats, rateDay, visitorFiat, numberFormat)}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ledger.unassignedSats > 0 ? (
          <p className="mt-2 text-xs text-app-muted">
            <span className="tabular-nums">
              {formatBitcoin(ledger.unassignedSats, numberFormat)}
              {preferredFiatSuffix(ledger.unassignedSats, rateDay, visitorFiat, numberFormat)}
            </span>{' '}
            {t('forum.creditUnassigned')}
          </p>
        ) : null}
      </section>
      <section aria-label={t('forum.creditBack')} className="mt-3">
        <h3 className="text-xs font-medium text-app-fg">{t('forum.creditBack')}</h3>
        <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackHow')}</p>
        {ledger.fundedAt === null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackOpen')}</p>
        ) : null}
        {fiat !== null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditFiatHow')}</p>
        ) : null}
        <RepaymentChart
          ledger={ledger}
          fiat={fiat}
          locale={locale}
          rateDay={rateDay}
          visitorFiat={visitorFiat}
        />
        {list === 'page' ? (
          <div className="mt-1 flex flex-col gap-2">
            {groupsOf(ledger.repayments).map((group) => (
              <div key={group.dayIndex}>
                <p className="text-xs font-medium text-app-fg">
                  {ledger.fundedAt === null || group.dueOn === null
                    ? t('forum.creditDay', { day: String(group.dayIndex + 1) })
                    : formatUtcDay(group.dueOn, locale)}
                </p>
                <ul>
                  {group.rows.map((row) => (
                    <li
                      key={`${row.dayIndex}:${row.accountId}`}
                      className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
                    >
                      <span className="min-w-0 truncate text-sm text-app-fg">
                        {giverLabel(row.name, row.username, row.accountId)}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5 sm:grid sm:grid-cols-[auto_5.5rem] sm:items-baseline sm:gap-x-2 sm:gap-y-0">
                        <span className="text-right text-sm tabular-nums text-app-fg">
                          {rowAmount(row, fiat, visitorFiat, rateDay, numberFormat)}
                        </span>
                        <span
                          className={`whitespace-nowrap text-right text-xs font-medium ${statusClass(row.status)}`}
                        >
                          {t(statusKey(row.status))}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <Link
            href={`/messages/${encodeURIComponent(messageId)}/repayment-list`}
            onClick={(event) => {
              event.stopPropagation();
            }}
            className="text-xs font-medium text-app-fg underline decoration-app-border underline-offset-2"
          >
            {t('forum.creditList')}
          </Link>
        )}
      </section>
    </div>
  );
}

function giverLabel(name: string, username: string | null, accountId: string): string {
  if (name !== '' && username !== null) {
    return `${name} @${username}`;
  }
  if (name !== '') {
    return name;
  }
  if (username !== null) {
    return `@${username}`;
  }
  return accountId.slice(0, 8);
}

function statusKey(status: RepaymentLine['status']): MessageKey {
  if (status === 'paid') {
    return 'forum.creditStatusPaid';
  }
  if (status === 'due') {
    return 'forum.creditStatusDue';
  }
  return 'forum.creditStatusScheduled';
}

function statusClass(status: RepaymentLine['status']): string {
  if (status === 'paid') {
    return 'text-app-success';
  }
  if (status === 'due') {
    return 'text-app-fg';
  }
  return 'text-app-muted';
}

function rowAmount(
  row: RepaymentLine,
  fiat: FiatCode | null,
  visitorFiat: FiatCode,
  rateDay: ReturnType<typeof useSpotRate>,
  numberFormat: NumberFormatStyle,
): ReactElement | null {
  if (fiat !== null && row.amount !== null) {
    const priced = formatFiatDisplay(row.amount, fiat, numberFormat);
    if (row.sats === null) {
      return <>{priced}</>;
    }
    return (
      <>
        {priced}
        <span aria-hidden="true"> · </span>
        {formatBitcoin(row.sats, numberFormat)}
        {visitorFiat === fiat
          ? null
          : preferredFiatSuffix(row.sats, rateDay, visitorFiat, numberFormat)}
      </>
    );
  }
  if (row.sats === null) {
    return null;
  }
  return (
    <>
      {formatBitcoin(row.sats, numberFormat)}
      {preferredFiatSuffix(row.sats, rateDay, visitorFiat, numberFormat)}
    </>
  );
}

function yearOf(dueOn: string): string {
  return dueOn.slice(0, 4);
}

function formatAxisDay(dueOn: string, locale: string, withYear: boolean): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(new Date(`${dueOn}T00:00:00Z`));
}

function formatUtcDay(dueOn: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dueOn}T00:00:00Z`));
}

function RepaymentChart({
  ledger,
  fiat,
  locale,
  rateDay,
  visitorFiat,
}: {
  ledger: RepaymentLedger;
  fiat: FiatCode | null;
  locale: string;
  rateDay: FiatRateDay | null;
  visitorFiat: FiatCode;
}): ReactElement | null {
  const { t, numberFormat } = useChartFormat();
  const groups = groupsOf(ledger.repayments);
  if (groups.length === 0) {
    return null;
  }
  const amounts = groups.map((group) => dayAmount(group.rows, fiat));
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) {
    return null;
  }
  const first = groups[0]!;
  const last = groups[groups.length - 1]!;
  const datesOpen = ledger.fundedAt !== null;
  const from =
    !datesOpen || first.dueOn === null
      ? t('forum.creditDay', { day: String(first.dayIndex + 1) })
      : formatAxisDay(first.dueOn, locale, false);
  const to =
    !datesOpen || last.dueOn === null
      ? t('forum.creditDay', { day: String(last.dayIndex + 1) })
      : formatAxisDay(
          last.dueOn,
          locale,
          first.dueOn === null || yearOf(first.dueOn) !== yearOf(last.dueOn),
        );
  const bitcoin = formatBitcoin(total, numberFormat);
  const priced = fiat === null ? satsToFiatAmount(total, rateDay, visitorFiat) : null;
  const totalText =
    fiat === null
      ? priced === null
        ? bitcoin
        : `${bitcoin} · ${formatFiatDisplay(priced, visitorFiat, numberFormat)}`
      : formatFiatDisplay(total.toFixed(2), fiat, numberFormat);
  return <RepaymentPlanChart amounts={amounts} from={from} to={to} totalText={totalText} />;
}

function useChartFormat(): {
  t: ReturnType<typeof useTranslations>['t'];
  numberFormat: NumberFormatStyle;
} {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  return { t, numberFormat };
}

function dayAmount(rows: readonly RepaymentLine[], fiat: FiatCode | null): number {
  let sum = 0;
  for (const row of rows) {
    if (fiat !== null) {
      if (row.amount === null) {
        continue;
      }
      const cents = Math.round(Number(row.amount) * 100);
      if (Number.isFinite(cents)) {
        sum += cents / 100;
      }
      continue;
    }
    if (row.sats !== null) {
      sum += row.sats;
    }
  }
  return sum;
}

function groupsOf(rows: readonly RepaymentLine[]): {
  dayIndex: number;
  dueOn: string | null;
  rows: RepaymentLine[];
}[] {
  const groups: { dayIndex: number; dueOn: string | null; rows: RepaymentLine[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.dayIndex === row.dayIndex) {
      last.rows.push(row);
    } else {
      groups.push({ dayIndex: row.dayIndex, dueOn: row.dueOn, rows: [row] });
    }
  }
  return groups;
}
