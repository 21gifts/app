import { type ReactElement } from 'react';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

/**
 * Preferred-fiat suffix next to a ₿ amount, or `null` when the rate or
 * conversion is missing (₿-only).
 *
 * @param sats - Whole sats.
 * @param rateDay - Latest gift-day totals, or `null`.
 * @param fiat - Visitor preference.
 * @param numberFormat - Grouping style.
 * @returns ` · ` plus formatted fiat, or `null`.
 */
export function preferredFiatSuffix(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): ReactElement | null {
  if (rateDay === null) {
    return null;
  }
  const amount = satsToFiatAmount(sats, rateDay, fiat);
  if (amount === null) {
    return null;
  }
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span>{formatFiatDisplay(amount, fiat, numberFormat)}</span>
    </>
  );
}
