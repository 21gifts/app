import { type ReactElement } from 'react';
import { committedFiatFigure } from '@/lib/committed-fiat';
import type { NumberFormatStyle } from '@/lib/number-format';
import {
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';

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

/** A stored decimal, or `null` when the field is absent. */
function storedDecimal(value: string | null | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Preferred-fiat suffix next to a ₿ amount.
 *
 * Omitted `stored` is a preview that is still being typed: the suffix is the
 * current spot rate. A passed `stored` object is a committed amount: the
 * visitor's stored string is shown as-is, and a null or missing field stays
 * absent. That path never uses the spot rate.
 *
 * @param sats - Whole sats. Used only when `stored` is omitted.
 * @param rateDay - Current spot rate, or `null`. Used only when `stored` is omitted.
 * @param fiat - Visitor's default fiat.
 * @param numberFormat - Grouping style.
 * @param stored - Fiat stored with a committed amount. When passed, a missing
 *   string for `fiat` returns `null`.
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
    const figure = committedFiatFigure(
      {
        amountCurrency: null,
        amount: null,
        amountUsd: storedDecimal(stored.amountUsd),
        amountChf: storedDecimal(stored.amountChf),
        amountEur: storedDecimal(stored.amountEur),
        amountPhp: storedDecimal(stored.amountPhp),
      },
      fiat,
    );
    if (figure === null) {
      return null;
    }
    return fiatSuffixMarkup(figure.amount, figure.code, numberFormat);
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
