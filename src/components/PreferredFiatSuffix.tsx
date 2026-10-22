import { type ReactElement } from 'react';
import { committedFiatFigure } from '@/lib/committed-fiat';
import { formatDefinedGoalAmount } from '@/lib/forum-goal';
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
  exact: boolean,
): ReactElement {
  const text = exact
    ? formatDefinedGoalAmount(amount, fiat, numberFormat)
    : formatFiatDisplay(amount, fiat, numberFormat);
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span>{text}</span>
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
 * A shown amount keeps both currencies whenever a stored string or a usable
 * rate exists. A stored string for the visitor's currency is shown as-is and
 * is never recomputed from sats. A null or missing field uses the current
 * spot. The suffix is absent only when neither a stored string nor a usable
 * rate exists.
 *
 * @param sats - Whole sats. Used when no stored string exists for `fiat`.
 * @param rateDay - Current spot rate, or `null`.
 * @param fiat - Visitor's default fiat.
 * @param numberFormat - Grouping style.
 * @param stored - Fiat stored with a committed amount. A string for `fiat`
 *   wins over `rateDay`.
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
    if (figure !== null) {
      return fiatSuffixMarkup(figure.amount, figure.code, numberFormat, true);
    }
  }
  if (rateDay === null) {
    return null;
  }
  const live = satsToFiatAmount(sats, rateDay, fiat);
  if (live === null) {
    return null;
  }
  return fiatSuffixMarkup(live, fiat, numberFormat, false);
}
