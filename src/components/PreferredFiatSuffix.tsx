import { type ReactElement } from 'react';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

const STORED_FIAT_FIELD = {
  USD: 'amountUsd',
  CHF: 'amountChf',
  EUR: 'amountEur',
  PHP: 'amountPhp',
} as const;

/** Fiat stored on a paid row for that row's `sats`. */
type StoredFiatAmounts = {
  amountUsd?: string | null | undefined;
  amountChf?: string | null | undefined;
  amountEur?: string | null | undefined;
  amountPhp?: string | null | undefined;
};

function fiatSuffixMarkup(
  amount: string,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): ReactElement {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span>{formatFiatDisplay(amount, fiat, numberFormat)}</span>
    </>
  );
}

/**
 * Preferred-fiat suffix next to a ₿ amount. A stored string is shown as-is.
 * When `stored` is passed, a present `null` or a missing field for the
 * visitor's currency is ₿-only and never uses the live rate. Omitting
 * `stored` keeps the unsent preview and may use the latest gift-day rate.
 *
 * @param sats - Whole sats.
 * @param rateDay - Latest gift-day totals, or `null`. Used only when `stored`
 *   is omitted.
 * @param fiat - Visitor preference.
 * @param numberFormat - Grouping style.
 * @param stored - Fiat stored when that payment was made. Omitted keeps the
 *   live rate. A present object is never live-converted: a string is
 *   formatted as-is; `null` or a missing field is ₿-only.
 * @returns ` · ` plus formatted fiat, or `null`.
 */
export function preferredFiatSuffix(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
  stored?: StoredFiatAmounts,
): ReactElement | null {
  if (stored !== undefined) {
    const amount = stored[STORED_FIAT_FIELD[fiat]];
    if (typeof amount !== 'string') {
      return null;
    }
    return fiatSuffixMarkup(amount, fiat, numberFormat);
  }
  if (rateDay === null) {
    return null;
  }
  const live = satsToFiatAmount(sats, rateDay, fiat);
  if (live === null) {
    return null;
  }
  return fiatSuffixMarkup(live, fiat, numberFormat);
}
