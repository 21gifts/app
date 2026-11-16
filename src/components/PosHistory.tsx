'use client';

import { ArrowDownLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { useSpotRate } from '@/hooks/useSpotRate';
import { committedFiatFigure, type FiatCode } from '@/lib/committed-fiat';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatForumTime } from '@/lib/forum-time';
import type { PosCharge, PosReceived } from '@/lib/pos';
import { formatBitcoin, formatFiatDisplay } from '@/lib/stats-money';

/** A stored fiat figure. An unusable string uses the two-decimal display of that same string. */
function exactStoredFiat(amount: string, code: FiatCode, style: NumberFormatStyle): string {
  const exact = formatDefinedGoalAmount(amount, code, style);
  return exact === '' ? formatFiatDisplay(amount, code, style) : exact;
}

/** What a past charge ended as. */
type PastStatus = 'paid' | 'expired' | 'cancelled';

/**
 * How a history row ended. The api has at most one open charge and returns
 * it as `charge`, so any other `pending` row has run out.
 */
function pastStatus(row: PosCharge): PastStatus {
  return row.status === 'pending' ? 'expired' : row.status;
}

/** Short local clock time of `iso`, or `null` when it is not a valid instant. */
function clockTime(iso: string, locale: string): string | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(instant);
}

/** One row of the list: a past charge, or a payment received without a charge. */
type HistoryRow = { kind: 'charge'; row: PosCharge } | { kind: 'received'; row: PosReceived };

/** On the same instant a charge comes before a received payment. */
const KIND_RANK = { charge: 0, received: 1 } as const;

/** When a row happened: a charge's creation, a payment's arrival; an unreadable time sorts last. */
function rowTime(item: HistoryRow): number {
  const time = Date.parse(item.kind === 'charge' ? item.row.createdAt : item.row.receivedAt);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Charges and received payments in one list by time, newest first. Without a
 * received payment the charges keep the order the till gives them. With one,
 * every row is placed by its time (a charge by its creation, a payment by its
 * arrival), and on the same instant a charge comes first.
 */
function mergeRows(charges: readonly PosCharge[], received: readonly PosReceived[]): HistoryRow[] {
  const rows: HistoryRow[] = charges.map((row) => ({ kind: 'charge', row }));
  if (received.length === 0) {
    return rows;
  }
  return [...rows, ...received.map((row): HistoryRow => ({ kind: 'received', row }))].sort(
    (a, b) => rowTime(b) - rowTime(a) || KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );
}

/** Props for {@link PosHistory}. */
export interface PosHistoryProps {
  /** `history` of `GET /pos/charge`, newest first; a row this tab's wallet saw paid may already be paid. */
  history: readonly PosCharge[];
  /** `received` of `GET /pos/charge`, newest first: payments that reached the wallet without a charge. */
  received: readonly PosReceived[];
  /** Id of the charge the till shows as open above the list, or `null`. */
  openChargeId: string | null;
}

/**
 * Past till charges under the `/pos` QR, newest first: status (**Paid ✓**
 * with the time it was paid, **Expired**, or **Cancelled**), the amount in
 * bitcoin with the currency figure stored on that charge, and the date and
 * time the charge was created. The open charge is shown above the list, not
 * in it. Payments the wallet received without a charge stand in the same
 * list, which is then ordered by time (a charge by its creation, a payment
 * by its arrival): a green arrow with **Received**, the amount
 * in bitcoin, and the date and time with **Instant payment** (Lightning) or
 * **Wallet transfer** (Spark). One that arrives while the list is shown eases
 * in like a new reply. With no past charge and no received payment the list
 * is one sentence. A stored figure is shown as-is. A charge with no stored
 * figure, and every received payment (none has a stored figure), shows the
 * current spot beside the bitcoin, and that spot is not written onto it.
 *
 * @param props - {@link PosHistoryProps}.
 * @returns The history section.
 */
export function PosHistory({ history, received, openChargeId }: PosHistoryProps): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  // The payments already listed when the list first showed; any other one arrived since.
  const [shownFirst] = useState(() => new Set(received.map((row) => row.id)));
  const rows = mergeRows(
    history.filter((row) => row.id !== openChargeId),
    received,
  );

  return (
    <section
      aria-label={t('pos.history')}
      className="flex w-full flex-col items-center gap-3 border-t border-app-border pt-6"
    >
      <h2 className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('pos.history')}
      </h2>
      {rows.length === 0 ? (
        <p className="text-center text-sm text-app-muted">{t('pos.historyEmpty')}</p>
      ) : (
        <ul className="flex w-full flex-col gap-2">
          {rows.map((item) => {
            if (item.kind === 'received') {
              const row = item.row;
              return (
                <li
                  key={`received-${row.id}`}
                  className={
                    shownFirst.has(row.id)
                      ? 'flex w-full flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3'
                      : 'flex w-full animate-fade-in flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3'
                  }
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="inline-flex items-center gap-1.5 self-center text-sm font-medium text-app-success">
                      <ArrowDownLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
                      {t('wallet.received')}
                    </span>
                    <span className="text-sm tabular-nums lining-nums text-app-fg">
                      <span>{formatBitcoin(row.amountSats, numberFormat)}</span>
                      {preferredFiatSuffix(row.amountSats, rateDay, fiat, numberFormat)}
                    </span>
                  </div>
                  <p className="text-xs text-app-subtle">
                    <time dateTime={row.receivedAt}>{formatForumTime(row.receivedAt, locale)}</time>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {row.kind === 'lightning'
                        ? t('wallet.payment.method.lightning')
                        : t('wallet.payment.method.spark')}
                    </span>
                  </p>
                </li>
              );
            }
            const row = item.row;
            const status = pastStatus(row);
            const paidTime = row.paidAt === null ? null : clockTime(row.paidAt, locale);
            let label: string;
            if (status === 'paid') {
              label =
                paidTime === null ? t('pos.paid') : t('pos.historyPaidAt', { time: paidTime });
            } else {
              label = status === 'expired' ? t('pos.expired') : t('pos.cancelled');
            }
            const figure = committedFiatFigure(row, fiat);
            return (
              <li
                key={`charge-${row.id}`}
                className="flex w-full flex-col gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span
                    className={
                      status === 'paid'
                        ? 'text-sm font-medium text-app-success'
                        : 'text-sm font-medium text-app-subtle'
                    }
                  >
                    {label}
                  </span>
                  <span className="text-sm tabular-nums lining-nums text-app-fg">
                    <span>{formatBitcoin(row.amountSats, numberFormat)}</span>
                    {figure === null ? (
                      preferredFiatSuffix(row.amountSats, rateDay, fiat, numberFormat)
                    ) : (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{exactStoredFiat(figure.amount, figure.code, numberFormat)}</span>
                      </>
                    )}
                  </span>
                </div>
                <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                  {formatForumTime(row.createdAt, locale)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
