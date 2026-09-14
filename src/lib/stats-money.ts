import type { Locale } from '@/lib/locale';
import {
  DEFAULT_NUMBER_FORMAT,
  formatGroupedNumber,
  separatorsFor,
  type NumberFormatStyle,
} from '@/lib/number-format';

/** Fiat codes offered on public stats (one selected at a time). */
export const FIAT_CODES = ['CHF', 'EUR', 'USD', 'PHP'] as const;

/** One of {@link FIAT_CODES}. */
export type FiatCode = (typeof FIAT_CODES)[number];

/**
 * Default stats fiat for a UI locale.
 *
 * @param locale - Active UI locale.
 * @returns CHF for `de`, PHP for `fil`, EUR for `es`, USD for `en`.
 */
export function defaultFiatForLocale(locale: Locale): FiatCode {
  switch (locale) {
    case 'de':
      return 'CHF';
    case 'fil':
      return 'PHP';
    case 'es':
      return 'EUR';
    case 'en':
      return 'USD';
  }
}

function fiatPrefix(code: FiatCode): string {
  return code === 'USD' ? '$' : `${code} `;
}

/**
 * Formats an API fiat amount for stats display using the visitor grouping style.
 *
 * @param amount - Two-decimal string from the api, or `null` when unsummed.
 * @param code - Selected fiat.
 * @param style - Grouping style (default Swiss `ch`).
 * @returns Currency string, or `—` when `amount` is `null`.
 */
export function formatFiatDisplay(
  amount: string | null,
  code: FiatCode,
  style: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): string {
  if (amount === null) {
    return '\u2014';
  }
  return `${fiatPrefix(code)}${formatGroupedNumber(Number(amount), style, 2)}`;
}

/**
 * Formats an API USD amount string for hero display.
 *
 * @param usd - Two-decimal USD string from the api (e.g. `"1425.00"`).
 * @param style - Grouping style (default Swiss `ch`).
 * @returns Currency string such as `$1'425.00`.
 */
export function formatUsdDisplay(
  usd: string,
  style: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): string {
  return formatFiatDisplay(usd, 'USD', style);
}

/**
 * Formats a whole-sat amount as BIP 177 ₿-only display.
 *
 * @param sats - Non-negative integer (the internal `sats` / `totalSats` field).
 *   Chart mid-ticks may pass a fractional value; those are rounded to whole sats.
 * @param style - Grouping style (default Swiss `ch`).
 * @returns Leading ₿, grouped integer, no space, no fraction. Example: `₿1'500`.
 */
export function formatBitcoin(
  sats: number,
  style: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): string {
  const whole = Math.round(sats);
  return `\u20BF${formatGroupedNumber(whole, style, 0)}`;
}

/**
 * Formats a fiat axis tick with grouping and a currency prefix.
 *
 * @param amount - Parsed fiat amount used for chart scale only.
 * @param code - Selected fiat.
 * @param style - Grouping style (default Swiss `ch`).
 * @returns Label such as `$1'425` or `CHF 1'425`.
 */
export function formatFiatTick(
  amount: number,
  code: FiatCode,
  style: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): string {
  const prefix = fiatPrefix(code);
  if (amount === 0) {
    return `${prefix}0`;
  }
  if (amount < 10) {
    const trimmed = amount.toFixed(2).replace(/\.?0+$/, '');
    const decimal = separatorsFor(style).decimal;
    return `${prefix}${trimmed.replace('.', decimal)}`;
  }
  return `${prefix}${formatGroupedNumber(Math.round(amount), style, 0)}`;
}

/**
 * Formats a USD axis tick with grouping and a dollar prefix.
 *
 * @param usd - Parsed USD amount used for chart scale only.
 * @param style - Grouping style (default Swiss `ch`).
 * @returns Label such as `$1'425`.
 */
export function formatUsdTick(
  usd: number,
  style: NumberFormatStyle = DEFAULT_NUMBER_FORMAT,
): string {
  return formatFiatTick(usd, 'USD', style);
}
