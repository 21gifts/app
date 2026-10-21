/** Fiat the till and a payment can store. */
export type FiatCode = 'USD' | 'CHF' | 'EUR' | 'PHP';

/**
 * Amounts stored with a charge or another committed payment.
 * A typed pair is `amountCurrency` plus `amount`. The other strings are
 * snapshots for one code, used only when that pair is absent.
 */
export interface StoredFiat {
  amountCurrency: FiatCode | null;
  amount: string | null;
  amountUsd: string | null;
  amountChf: string | null;
  amountEur: string | null;
  amountPhp: string | null;
}

/** True when `value` is one of the four stored fiat codes. */
function isFiatCode(value: FiatCode | null): value is FiatCode {
  return value === 'USD' || value === 'CHF' || value === 'EUR' || value === 'PHP';
}

/** The stored snapshot for `code`, or `null` when that snapshot was not stored. */
function snapshot(stored: StoredFiat, code: FiatCode): string | null {
  let value: string | null;
  if (code === 'USD') {
    value = stored.amountUsd;
  } else if (code === 'CHF') {
    value = stored.amountChf;
  } else if (code === 'EUR') {
    value = stored.amountEur;
  } else {
    value = stored.amountPhp;
  }
  return typeof value === 'string' ? value : null;
}

/**
 * The stored figure both sides show. Null means no stored figure: the caller
 * shows the current spot beside bitcoin and does not write it back. Never
 * takes a rate.
 *
 * When `amountCurrency` and `amount` are both set, that pair is the figure and
 * the viewer's currency is ignored. Otherwise, when `preferred` names a code
 * whose stored string is set, that string is the figure.
 *
 * @param stored - Currency and decimal strings saved with the amount.
 * @param preferred - Viewer's code, used only when no typed pair is stored.
 * @returns The code and the exact stored decimal, or `null`.
 */
export function committedFiatFigure(
  stored: StoredFiat,
  preferred?: FiatCode | null,
): { code: FiatCode; amount: string } | null {
  if (isFiatCode(stored.amountCurrency) && typeof stored.amount === 'string') {
    return { code: stored.amountCurrency, amount: stored.amount };
  }
  if (preferred === undefined || preferred === null) {
    return null;
  }
  const amount = snapshot(stored, preferred);
  if (amount === null) {
    return null;
  }
  return { code: preferred, amount };
}
