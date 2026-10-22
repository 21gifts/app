'use client';

import type { ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { useSpotRate } from '@/hooks/useSpotRate';
import { committedFiatFigure, type FiatCode } from '@/lib/committed-fiat';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatForumTime } from '@/lib/forum-time';
import type { PosCharge } from '@/lib/pos';
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

/** Props for {@link PosHistory}. */
export interface PosHistoryProps {
  /** `history` of `GET /pos/charge`, newest first, as the api returns it. */
  history: readonly PosCharge[];
  /** Id of the charge the till shows as open above the list, or `null`. */
  openChargeId: string | null;
}

/**
 * Past till charges under the `/pos` QR, newest first: status (**Paid ✓**
 * with the time it was paid, **Expired**, or **Cancelled**), the amount in
 * bitcoin with the currency figure stored on that charge, and the date and
 * time the charge was created. The open charge is shown above the list, not
 * in it. With no past charge the list is one sentence. A stored figure is
 * shown as-is. A charge with no stored figure shows the current spot beside
 * the bitcoin, and that spot is not written onto the charge.
 *
 * @param props - {@link PosHistoryProps}.
 * @returns The history section.
 */
export function PosHistory({ history, openChargeId }: PosHistoryProps): ReactElement {
  const { t, locale } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const rows = history.filter((row) => row.id !== openChargeId);

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
          {rows.map((row) => {
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
                key={row.id}
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
