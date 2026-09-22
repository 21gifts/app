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
 * Preferred-fiat suffix next to a ₿ amount, or `null` when the stored amount
 * or live conversion is missing (₿-only).
 *
 * @param sats - Whole sats.
 * @param rateDay - Latest gift-day totals, or `null`. Used when `stored` is
 *   omitted or the selected stored field is absent.
 * @param fiat - Visitor preference.
 * @param numberFormat - Grouping style.
 * @param stored - Fiat stored when that payment was made. Omitted keeps the
 *   live rate. A present `null` field is ₿-only; a string is formatted as-is.
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
    if (amount === null) {
      return null;
    }
    if (amount !== undefined) {
      return fiatSuffixMarkup(amount, fiat, numberFormat);
    }
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
