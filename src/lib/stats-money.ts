import type { Locale } from '@/lib/locale';

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

/**
 * Formats an API fiat amount for stats display.
 *
 * ICU may insert a narrow no-break space next to a currency code; non-USD
 * labels are rebuilt from parts so the code always prefixes the number.
 *
 * @param amount - Two-decimal string from the api, or `null` when unsummed.
 * @param code - Selected fiat.
 * @returns Locale currency string, or `—` when `amount` is `null`.
 */
export function formatFiatDisplay(amount: string | null, code: FiatCode): string {
  if (amount === null) {
    return '\u2014';
  }
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    currencyDisplay: code === 'USD' ? 'symbol' : 'code',
  }).formatToParts(Number(amount));
  if (code === 'USD') {
    return parts.map((part) => part.value).join('');
  }
  const number = parts
    .filter((part) => part.type !== 'currency' && part.type !== 'literal')
    .map((part) => part.value)
    .join('');
  return `${code} ${number}`;
}

/**
 * Formats an API USD amount string for hero display.
 *
 * @param usd - Two-decimal USD string from the api (e.g. `"1425.00"`).
 * @returns Locale currency string such as `$1,425.00`.
 */
export function formatUsdDisplay(usd: string): string {
  return formatFiatDisplay(usd, 'USD');
}

/**
 * Formats a whole-sat amount as BIP 177 ₿-only display.
 *
 * @param sats - Non-negative integer (the internal `sats` / `totalSats` field).
 *   Chart mid-ticks may pass a fractional value; those are rounded to whole sats.
 * @param locale - BCP-47 tag for grouping (default `'en-US'`). `fil` is valid.
 * @returns Leading ₿, grouped integer, no space, no fraction. Example: `₿1,500,000`.
 */
export function formatBitcoin(sats: number, locale = 'en-US'): string {
  const whole = Math.round(sats);
  return `\u20BF${new Intl.NumberFormat(locale).format(whole)}`;
}

/**
 * Formats a fiat axis tick with grouping and a currency prefix.
 *
 * @param amount - Parsed fiat amount used for chart scale only.
 * @param code - Selected fiat.
 * @returns Label such as `$1,425` or `CHF 1,425`.
 */
export function formatFiatTick(amount: number, code: FiatCode): string {
  const prefix = code === 'USD' ? '$' : `${code} `;
  if (amount === 0) {
    return `${prefix}0`;
  }
  if (amount < 10) {
    return `${prefix}${amount.toFixed(2).replace(/\.?0+$/, '')}`;
  }
  return `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))}`;
}

/**
 * Formats a USD axis tick with grouping and a dollar prefix.
 *
 * @param usd - Parsed USD amount used for chart scale only.
 * @returns Label such as `$1,234`.
 */
export function formatUsdTick(usd: number): string {
  return formatFiatTick(usd, 'USD');
}
