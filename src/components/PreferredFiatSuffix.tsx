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
 * Preferred-fiat suffix next to a ₿ amount.
 *
 * A shown amount is never one currency when a stored string or a usable rate
 * exists. Bitcoin is not the visitor's default fiat, so this suffix is that
 * fiat beside it. A stored string for that currency is shown as-is. A null
 * or missing field uses the gift-day rate when one is loaded. Returns null,
 * so the amount stays bitcoin, only when neither a stored string nor a
 * usable rate exists.
 *
 * @param sats - Whole sats.
 * @param rateDay - Latest gift-day totals, or `null`. Used when `stored`
 *   has no string for `fiat`.
 * @param fiat - Visitor's default fiat.
 * @param numberFormat - Grouping style.
 * @param stored - Fiat stored when that payment was made. A string wins.
 *   Null or a missing field falls through to `rateDay`.
 * @returns ` · ` plus formatted fiat, or `null` when no figure exists.
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
    if (typeof amount === 'string') {
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
