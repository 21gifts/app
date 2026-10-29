'use client';

import { useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { RepaymentPlanChart } from '@/components/RepaymentPlanChart';
import { useSpotRate } from '@/hooks/useSpotRate';
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
 * link to the repayment list. `list="page"` omits that link. A short plan, or
 * one that is not fully given or is missing a date, lists each day. A fully
 * given plan with more than 7 dated days shows the month overview instead.
 * Still owed there counts only unpaid shares. A month names one status only
 * when every share in that month has it. A fiat plan, share, still-owed
 * total, and chart total stay in the ask currency, with no bitcoin. Money
 * already given keeps that currency and bitcoin. A bitcoin amount shows the
 * current spot beside it. The spot is not written onto the row. A day matches
 * another day by the amount the page shows: the ask currency, or satoshis.
 * The footnote lists the days a month lists, and names one remaining total
 * only when every other day shares it.
 * A due line whose giver cannot receive yet (`waiting`) reads **Waiting**, in
 * muted type, under a line that names that giver.
 * `onLedger` hears every loaded ledger (the first read and
 * each refresh), so the loan block above can show the paid-back share without
 * a second request.
 *
 * @param props - Credit note id, which list to render, and an optional listener for the loaded ledger.
 * @returns The two lists, or null.
 */
export function CreditLedger({
  messageId,
  list = 'summary',
  onLedger,
}: {
  messageId: string;
  list?: 'summary' | 'page';
  onLedger?: ((ledger: RepaymentLedger) => void) | undefined;
}): ReactElement | null {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat: visitorFiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const [loaded, setLoaded] = useState<{
    messageId: string;
    ledger: RepaymentLedger;
  } | null>(null);
  const current = loaded !== null && loaded.messageId === messageId ? loaded.ledger : null;
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
    if (current !== null) {
      onLedger?.(current);
    }
  }, [current, onLedger]);
  useEffect(() => {
    if (current === null || !current.repayments.some((row) => row.status === 'due')) {
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
  }, [current, messageId]);
  if (current === null) {
    return null;
  }
  const ledger = withWaiting(current);
  const fiat = ledger.currency === 'BTC' ? null : (ledger.currency as FiatCode);
  const spot: SpotPair = { rateDay, visitorFiat };
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
                    <>
                      {formatFiatDisplay(giver.givenAmount, fiat, numberFormat)}
                      <span aria-hidden="true"> · </span>
                      {formatBitcoin(giver.givenSats, numberFormat)}
                    </>
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
        {typeof ledger.startsOn === 'string' ? (
          <p className="mt-1 text-xs font-medium text-app-fg">
            {t('forum.creditStartsOn', { date: formatLongDay(ledger.startsOn, locale) })}
          </p>
        ) : null}
        {ledger.fundedAt === null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditBackOpen')}</p>
        ) : null}
        {fiat !== null ? (
          <p className="mt-1 text-xs text-app-muted">{t('forum.creditFiatHow')}</p>
        ) : null}
        <RepaymentChart ledger={ledger} fiat={fiat} locale={locale} spot={spot} />
        {list === 'page' ? (
          isLongRepayment(ledger) ? (
            <LongRepayment
              ledger={ledger}
              fiat={fiat}
              locale={locale}
              numberFormat={numberFormat}
              spot={spot}
              t={t}
            />
          ) : (
            <DayGroups
              groups={groupsOf(ledger.repayments)}
              fundedAt={ledger.fundedAt}
              fiat={fiat}
              locale={locale}
              numberFormat={numberFormat}
              spot={spot}
              t={t}
            />
          )
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

type Translate = ReturnType<typeof useTranslations>['t'];

/** Current spot used beside a bitcoin amount that stored no fiat figure. */
type SpotPair = {
  rateDay: FiatRateDay | null;
  visitorFiat: FiatCode;
};

type DayGroup = {
  dayIndex: number;
  dueOn: string | null;
  rows: RepaymentLine[];
};

function DayGroups({
  groups,
  fundedAt,
  fiat,
  locale,
  numberFormat,
  spot,
  t,
}: {
  groups: readonly DayGroup[];
  fundedAt: string | null;
  fiat: FiatCode | null;
  locale: string;
  numberFormat: NumberFormatStyle;
  spot: SpotPair;
  t: Translate;
}): ReactElement {
  return (
    <div className="mt-1 flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.dayIndex}>
          <p className="text-xs font-medium text-app-fg">
            {fundedAt === null || group.dueOn === null
              ? t('forum.creditDay', { day: String(group.dayIndex + 1) })
              : formatUtcDay(group.dueOn, locale)}
          </p>
          <ul>
            {group.rows.map((row) => (
              <li
                key={`${row.dayIndex}:${row.accountId}`}
                className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-app-fg">
                    {giverLabel(row.name, row.username, row.accountId)}
                  </span>
                  {row.waiting === true ? (
                    <span className="block text-xs text-app-muted">
                      {t('loans.waitingFor', {
                        name: giverLabel(row.name, row.username, row.accountId),
                      })}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 sm:grid sm:grid-cols-[auto_5.5rem] sm:items-baseline sm:gap-x-2 sm:gap-y-0">
                  <span className="text-right text-sm tabular-nums text-app-fg">
                    {rowAmount(row, fiat, numberFormat, spot)}
                  </span>
                  <span
                    className={`whitespace-nowrap text-right text-xs font-medium ${
                      row.waiting === true ? 'text-app-muted' : statusClass(row.status)
                    }`}
                  >
                    {t(lineStatusKey(row))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LongRepayment({
  ledger,
  fiat,
  locale,
  numberFormat,
  spot,
  t,
}: {
  ledger: RepaymentLedger;
  fiat: FiatCode | null;
  locale: string;
  numberFormat: NumberFormatStyle;
  spot: SpotPair;
  t: Translate;
}): ReactElement {
  const groups = groupsOf(ledger.repayments);
  const owed = groups
    .filter((group) => rowsStatus(group.rows) !== 'paid')
    .reduce(
      (sum, group) =>
        sum +
        dayAmount(
          group.rows.filter((row) => row.status !== 'paid'),
          fiat,
        ),
      0,
    );
  const first = groups[0]!;
  const last = groups[groups.length - 1]!;
  const next = groups.find((group) => rowsStatus(group.rows) !== 'paid');
  const people = peopleOf(ledger.repayments);
  const usualIndex = usualGroupIndex(groups, fiat);
  const usual = groups[usualIndex]!;
  const months = monthsOf(groups).map((month) => {
    const usualGroup = month.groups[usualGroupIndex(month.groups, fiat)]!;
    const key = daySignature(usualGroup.rows, fiat);
    return {
      key: month.key,
      usualGroup,
      rows: month.groups.flatMap((group) => group.rows),
      usualGroups: month.groups.filter((group) => daySignature(group.rows, fiat) === key),
      exceptions: month.groups.filter((group) => daySignature(group.rows, fiat) !== key),
    };
  });
  const exceptions = months.flatMap((month) => month.exceptions);
  const rest = groups.filter(
    (group) => !exceptions.some((item) => item.dayIndex === group.dayIndex),
  );
  const restUsual = exceptions.length > 0 ? uniformDay(rest, fiat) : null;
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-app-fg">
        {t('forum.creditChartDebt')} {totalAmountText(owed, fiat, numberFormat, spot)}
      </p>
      <p className="mt-1 text-xs text-app-muted">
        {t('forum.creditRange', {
          from: formatUtcDay(first.dueOn!, locale),
          to: formatUtcDay(last.dueOn!, locale),
        })}
      </p>
      <p className="mt-1 text-xs text-app-muted">
        {t('forum.creditProgress', {
          paid: String(ledger.daysPaid),
          days: String(groups.length),
        })}
      </p>
      {next !== undefined ? (
        <div className="mt-2">
          <p className="text-xs font-medium text-app-fg">{t('forum.creditNext')}</p>
          <DayGroups
            groups={[next]}
            fundedAt={ledger.fundedAt}
            fiat={fiat}
            locale={locale}
            numberFormat={numberFormat}
            spot={spot}
            t={t}
          />
        </div>
      ) : null}
      <section aria-label={t('forum.creditEachDay')} className="mt-3">
        <h3 className="text-xs font-medium text-app-fg">{t('forum.creditEachDay')}</h3>
        <ul className="mt-1">
          {people.map((person) => {
            const own = ledger.repayments.filter((row) => row.accountId === person.accountId);
            const usualAmount = usualPersonAmount(own, fiat);
            const usualRow: RepaymentLine = { ...own[0]!, ...usualAmount };
            return (
              <li
                key={person.accountId}
                className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5 first:border-t-0"
              >
                <span className="min-w-0 truncate text-sm text-app-fg">
                  {giverLabel(person.name, person.username, person.accountId)}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums text-app-fg">
                  {lineAmountText(usualRow, fiat, numberFormat, spot)}
                  {' · '}
                  {t('forum.creditDaysCount', { count: own.length })}
                  {' · '}
                  {totalAmountText(dayAmount(own, fiat), fiat, numberFormat, spot)}
                </span>
              </li>
            );
          })}
          <li className="flex items-baseline justify-between gap-3 border-t border-app-border py-1.5">
            <span className="text-sm font-medium text-app-fg">{t('forum.creditTogether')}</span>
            <span className="shrink-0 text-right text-sm font-medium tabular-nums text-app-fg">
              {totalAmountText(dayAmount(usual.rows, fiat), fiat, numberFormat, spot)}
              {' · '}
              {t('forum.creditDaysCount', { count: groups.length })}
              {' · '}
              {totalAmountText(dayAmount(ledger.repayments, fiat), fiat, numberFormat, spot)}
            </span>
          </li>
        </ul>
      </section>
      <div className="mt-3 flex flex-col gap-3">
        {months.map((month) => {
          return (
            <section key={month.key}>
              <h3 className="text-xs font-medium text-app-fg">{formatMonth(month.key, locale)}</h3>
              <p className="mt-1 text-xs text-app-muted">
                {monthCountLabel(month.usualGroups.length + month.exceptions.length, month.rows, t)}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                {t('forum.creditUsualDays', {
                  count: month.usualGroups.length,
                  amount: totalAmountText(
                    dayAmount(month.usualGroup.rows, fiat),
                    fiat,
                    numberFormat,
                    spot,
                  ),
                })}
              </p>
              <p className="mt-1 text-xs text-app-muted">
                {t('forum.creditUsualSplit', {
                  split: splitText(month.usualGroup.rows, fiat, numberFormat, spot),
                })}
              </p>
              {month.exceptions.length > 0 ? (
                <DayGroups
                  groups={month.exceptions}
                  fundedAt={ledger.fundedAt}
                  fiat={fiat}
                  locale={locale}
                  numberFormat={numberFormat}
                  spot={spot}
                  t={t}
                />
              ) : null}
            </section>
          );
        })}
      </div>
      {exceptions.length > 0 ? (
        <p className="mt-2 text-xs text-app-muted">
          {exceptions
            .map((group) => {
              return `${formatUtcDay(group.dueOn!, locale)}: ${splitText(group.rows, fiat, numberFormat, spot)} ${totalAmountText(dayAmount(group.rows, fiat), fiat, numberFormat, spot)}.`;
            })
            .join(' ')}
          {restUsual !== null
            ? ` ${t('forum.creditUsualRest', {
                amount: totalAmountText(dayAmount(restUsual.rows, fiat), fiat, numberFormat, spot),
              })}`
            : ''}
        </p>
      ) : null}
    </div>
  );
}

function isLongRepayment(ledger: RepaymentLedger): boolean {
  if (ledger.fundedAt === null) {
    return false;
  }
  const groups = groupsOf(ledger.repayments);
  if (groups.length <= 7) {
    return false;
  }
  return groups.every((group) => group.dueOn !== null);
}

function rowsStatus(rows: readonly RepaymentLine[]): RepaymentLine['status'] {
  if (rows.every((row) => row.status === 'paid')) {
    return 'paid';
  }
  if (rows.some((row) => row.status === 'due')) {
    return 'due';
  }
  return 'scheduled';
}

function monthCountLabel(count: number, rows: readonly RepaymentLine[], t: Translate): string {
  const key = lineStatusKey(rows[0]!);
  if (!rows.every((row) => lineStatusKey(row) === key)) {
    return t('forum.creditDaysCount', { count });
  }
  return t('forum.creditMonthDays', { count, status: t(key) });
}

function uniformDay(groups: readonly DayGroup[], fiat: FiatCode | null): DayGroup | null {
  const first = groups[0]!;
  const key = dayTotalKey(first.rows, fiat);
  if (groups.every((group) => dayTotalKey(group.rows, fiat) === key)) {
    return first;
  }
  return null;
}

function dayTotalKey(rows: readonly RepaymentLine[], fiat: FiatCode | null): number {
  const total = dayAmount(rows, fiat);
  if (fiat === null) {
    return total;
  }
  // 39.99 + 0.81 and 40.00 + 0.80 both show 40.80, but the sums are not bitwise equal.
  return Math.round(total * 100);
}

function daySignature(rows: readonly RepaymentLine[], fiat: FiatCode | null): string {
  return rows
    .map((row) =>
      fiat !== null
        ? `${row.accountId}\u0000${row.amount}\u0000${row.waiting === true}`
        : `${row.accountId}\u0000${row.sats}\u0000${row.waiting === true}`,
    )
    .sort()
    .join('\u0001');
}

function usualGroupIndex(groups: readonly DayGroup[], fiat: FiatCode | null): number {
  const waits = (group: DayGroup): boolean => group.rows.some((row) => row.waiting === true);
  const skipWaiting = groups.some((group) => !waits(group));
  const counts = new Map<string, { count: number; index: number }>();
  groups.forEach((group, index) => {
    if (skipWaiting && waits(group)) {
      return;
    }
    const key = daySignature(group.rows, fiat);
    const seen = counts.get(key);
    if (seen === undefined) {
      counts.set(key, { count: 1, index });
    } else {
      seen.count += 1;
    }
  });
  let bestIndex = 0;
  let bestCount = -1;
  for (const info of counts.values()) {
    if (info.count > bestCount) {
      bestCount = info.count;
      bestIndex = info.index;
    }
  }
  return bestIndex;
}

function peopleOf(rows: readonly RepaymentLine[]): RepaymentLine[] {
  const seen = new Set<string>();
  const people: RepaymentLine[] = [];
  for (const row of rows) {
    if (seen.has(row.accountId)) {
      continue;
    }
    seen.add(row.accountId);
    people.push(row);
  }
  return people;
}

function usualPersonAmount(
  rows: readonly RepaymentLine[],
  fiat: FiatCode | null,
): { amount: string | null; sats: number | null } {
  const counts = new Map<string, { count: number; amount: string | null; sats: number | null }>();
  for (const row of rows) {
    const key = fiat !== null ? `${row.amount}` : `${row.sats}`;
    const seen = counts.get(key);
    if (seen === undefined) {
      counts.set(key, { count: 1, amount: row.amount, sats: row.sats });
    } else {
      seen.count += 1;
    }
  }
  let bestCount = 0;
  let bestAmount: string | null = null;
  let bestSats: number | null = null;
  for (const info of counts.values()) {
    if (info.count > bestCount) {
      bestCount = info.count;
      bestAmount = info.amount;
      bestSats = info.sats;
    }
  }
  return { amount: bestAmount, sats: bestSats };
}

function bitcoinText(sats: number, numberFormat: NumberFormatStyle, spot: SpotPair): string {
  const bitcoin = formatBitcoin(sats, numberFormat);
  const priced =
    spot.rateDay === null ? null : satsToFiatAmount(sats, spot.rateDay, spot.visitorFiat);
  if (priced === null) {
    return bitcoin;
  }
  return `${bitcoin} · ${formatFiatDisplay(priced, spot.visitorFiat, numberFormat)}`;
}

function lineAmountText(
  row: RepaymentLine,
  fiat: FiatCode | null,
  numberFormat: NumberFormatStyle,
  spot: SpotPair,
): string {
  if (fiat !== null && row.amount !== null) {
    return formatFiatDisplay(row.amount, fiat, numberFormat);
  }
  if (row.sats !== null) {
    return bitcoinText(row.sats, numberFormat, spot);
  }
  return '';
}

function totalAmountText(
  total: number,
  fiat: FiatCode | null,
  numberFormat: NumberFormatStyle,
  spot: SpotPair,
): string {
  if (fiat !== null) {
    return formatFiatDisplay(total.toFixed(2), fiat, numberFormat);
  }
  return bitcoinText(total, numberFormat, spot);
}

function splitText(
  rows: readonly RepaymentLine[],
  fiat: FiatCode | null,
  numberFormat: NumberFormatStyle,
  spot: SpotPair,
): string {
  return rows
    .map(
      (row) =>
        `${giverLabel(row.name, row.username, row.accountId)} ${lineAmountText(row, fiat, numberFormat, spot)}`,
    )
    .join(' · ');
}

function formatMonth(monthKey: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function monthsOf(groups: readonly DayGroup[]): { key: string; groups: DayGroup[] }[] {
  const months: { key: string; groups: DayGroup[] }[] = [];
  for (const group of groups) {
    const key = group.dueOn!.slice(0, 7);
    const last = months[months.length - 1];
    if (last !== undefined && last.key === key) {
      last.groups.push(group);
    } else {
      months.push({ key, groups: [group] });
    }
  }
  return months;
}

/**
 * Marks a due line whose giver cannot receive as waiting when the api did not
 * send `waiting` (the rule of `dueShares`).
 */
function withWaiting(ledger: RepaymentLedger): RepaymentLedger {
  const cannotReceive = new Set(
    ledger.givers.filter((giver) => !giver.canReceive).map((giver) => giver.accountId),
  );
  return {
    ...ledger,
    repayments: ledger.repayments.map((row) =>
      row.waiting !== undefined || row.status !== 'due'
        ? row
        : { ...row, waiting: cannotReceive.has(row.accountId) },
    ),
  };
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

function lineStatusKey(row: RepaymentLine): MessageKey {
  return row.waiting === true ? 'forum.creditStatusWaiting' : statusKey(row.status);
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
  numberFormat: NumberFormatStyle,
  spot: SpotPair,
): ReactElement | null {
  if (fiat !== null && row.amount !== null) {
    return <>{formatFiatDisplay(row.amount, fiat, numberFormat)}</>;
  }
  if (row.sats === null) {
    return null;
  }
  return (
    <>
      {formatBitcoin(row.sats, numberFormat)}
      {preferredFiatSuffix(row.sats, spot.rateDay, spot.visitorFiat, numberFormat)}
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

function formatLongDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${day}T00:00:00Z`));
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
  spot,
}: {
  ledger: RepaymentLedger;
  fiat: FiatCode | null;
  locale: string;
  spot: SpotPair;
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
  const totalText = totalAmountText(total, fiat, numberFormat, spot);
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
