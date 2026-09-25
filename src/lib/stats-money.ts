import type { Locale } from '@/lib/locale';
import {
  DEFAULT_NUMBER_FORMAT,
  formatGroupedNumber,
  separatorsFor,
  type NumberFormatStyle,
} from '@/lib/number-format';

/** Supported preferred-fiat codes (switchers on Profile, the activity chart, `/stats`, and `/stats/[day]`; forum and the pay sheet display the code). */
export const FIAT_CODES = ['CHF', 'EUR', 'USD', 'PHP'] as const;

/** One of {@link FIAT_CODES}. */
export type FiatCode = (typeof FIAT_CODES)[number];

/** Cookie written when the visitor picks a fiat on Profile, the activity chart, `/stats`, or `/stats/[day]`. */
export const FIAT_COOKIE = 'fiat';

/**
 * Returns `value` if it is exactly one of {@link FIAT_CODES}; otherwise
 * `fallback`. Case-sensitive.
 *
 * @param value - Raw cookie or option value, or undefined when absent.
 * @param fallback - Code used when `value` is missing or invalid.
 * @returns A supported fiat code.
 */
export function parseFiatCode(value: string | undefined, fallback: FiatCode): FiatCode {
  if (value === undefined) {
    return fallback;
  }
  for (const code of FIAT_CODES) {
    if (code === value) {
      return code;
    }
  }
  return fallback;
}

/**
 * Default preferred fiat for a UI locale when the `fiat` cookie is absent.
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
 * Amount prefix. `$` and `₱` sit tight like `₿`; CHF and EUR keep the code.
 *
 * @param code - Fiat code (`CHF`, `EUR`, `USD`, or `PHP`).
 * @returns `'$'`, `'₱'`, `'CHF '`, or `'EUR '`.
 */
export function fiatPrefix(code: FiatCode): string {
  if (code === 'USD') {
    return '$';
  }
  if (code === 'PHP') {
    return '₱';
  }
  return `${code} `;
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

/** One gift-day row used to scale sats into CHF/EUR/USD/PHP. */
export interface FiatRateDay {
  /** Gift sats on that UTC day (must be greater than 0). */
  sats: number;
  /** USD total for that day. */
  usd: string;
  /** CHF total, or `null` when unsummed. */
  chf: string | null;
  /** EUR total, or `null` when unsummed. */
  eur: string | null;
  /** PHP total, or `null` when unsummed. */
  php: string | null;
}

function fiatFieldOnDay(day: FiatRateDay, code: FiatCode): string | null {
  switch (code) {
    case 'USD':
      return day.usd;
    case 'CHF':
      return day.chf;
    case 'EUR':
      return day.eur;
    case 'PHP':
      return day.php;
  }
}

/**
 * Latest spend-over-time day that has gifts, for sats→fiat scaling.
 *
 * @param series - `GET /gifts/stats` `spendOverTime` (oldest first).
 * @returns Last day with `sats > 0`, or `null`.
 */
export function latestRateDay(series: readonly FiatRateDay[]): FiatRateDay | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const day = series[i];
    if (day !== undefined && day.sats > 0) {
      return day;
    }
  }
  return null;
}

/** The four amounts shown next to a sat amount, or null when that currency has no rate. */
export interface ShownFiat {
  amountUsd: string | null;
  amountChf: string | null;
  amountEur: string | null;
  amountPhp: string | null;
}

/**
 * The fiat the payer sees for these sats, using the same day as the preview.
 *
 * @param sats - Whole sats about to be paid.
 * @param rateDay - Latest gift day, or null when no rate is on screen.
 * @returns Four strings or nulls. Null is stored as empty, not filled in later.
 */
export function shownFiatForSats(sats: number, rateDay: FiatRateDay | null): ShownFiat {
  return {
    amountUsd: satsToFiatAmount(sats, rateDay, 'USD'),
    amountChf: satsToFiatAmount(sats, rateDay, 'CHF'),
    amountEur: satsToFiatAmount(sats, rateDay, 'EUR'),
    amountPhp: satsToFiatAmount(sats, rateDay, 'PHP'),
  };
}

/**
 * Scales whole sats into a two-decimal fiat amount using one gift day's totals.
 *
 * @param sats - Whole sats to convert (may be 0).
 * @param day - Gift day with `sats > 0`, or `null`.
 * @param code - Selected fiat.
 * @returns Two-decimal string, or `null` when the day or that fiat is missing
 *   or zero (a `"0.00"` gift-day total is not a usable rate).
 */
export function satsToFiatAmount(
  sats: number,
  day: FiatRateDay | null,
  code: FiatCode,
): string | null {
  if (day === null || day.sats <= 0 || sats < 0 || !Number.isFinite(sats)) {
    return null;
  }
  const raw = fiatFieldOnDay(day, code);
  if (raw === null) {
    return null;
  }
  const fiat = Number(raw);
  if (!Number.isFinite(fiat) || fiat === 0) {
    return null;
  }
  const cents = Math.round((fiat * 100 * sats) / day.sats);
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100)
    .toString()
    .padStart(2, '0');
  return `${whole}.${frac}`;
}

/**
 * Fiat typing draft for an exact sat amount.
 *
 * Uses two decimals when that round-trips through {@link fiatToSats}.
 * Otherwise adds fraction digits, up to eight, so toggling back returns
 * the same sats. Returns `null` when the day or that fiat cannot be used,
 * or when no digit count round-trips.
 *
 * @param sats - Whole sats to show.
 * @param day - Gift day, or `null`.
 * @param code - Preferred fiat.
 * @returns A plain dot-decimal string, or `null`.
 */
export function fiatDraftForSats(
  sats: number,
  day: FiatRateDay | null,
  code: FiatCode,
): string | null {
  if (day === null || !Number.isFinite(sats) || sats < 0) {
    return null;
  }
  const two = satsToFiatAmount(sats, day, code);
  if (two !== null && fiatToSats(Number(two), day, code) === sats) {
    return two;
  }
  const raw = fiatFieldOnDay(day, code);
  if (raw === null || day.sats <= 0) {
    return null;
  }
  const dayFiat = Number(raw);
  if (!Number.isFinite(dayFiat) || dayFiat === 0) {
    return null;
  }
  const exact = (sats * dayFiat) / day.sats;
  for (let digits = 3; digits <= 8; digits += 1) {
    const text = exact.toFixed(digits);
    if (fiatToSats(Number(text), day, code) === sats) {
      return text;
    }
  }
  return null;
}

/** A trimmed amount draft, as whole sats or a reason it is not. */
export type AmountDraft = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'sats'; sats: number };

const FIAT_DRAFT = /^\d+([.,]\d{0,8})?$/;

/**
 * Inverse of {@link satsToFiatAmount} on the same gift-day totals.
 *
 * @param amount - Fiat amount (not a grouped string).
 * @param day - Gift day with `sats > 0`, or `null`.
 * @param code - Selected fiat.
 * @returns Whole sats, `0` when `amount` is 0, `1` when a positive amount
 *   rounds to 0, or `null` when the day or that fiat is missing or zero.
 */
export function fiatToSats(amount: number, day: FiatRateDay | null, code: FiatCode): number | null {
  if (day === null || day.sats <= 0 || !Number.isFinite(amount) || amount < 0) {
    return null;
  }
  const raw = fiatFieldOnDay(day, code);
  if (raw === null) {
    return null;
  }
  const dayFiat = Number(raw);
  if (!Number.isFinite(dayFiat) || dayFiat === 0) {
    return null;
  }
  if (amount === 0) {
    return 0;
  }
  const sats = Math.round((amount * day.sats) / dayFiat);
  if (!Number.isFinite(sats) || !Number.isSafeInteger(sats)) {
    return null;
  }
  if (sats === 0) {
    return 1;
  }
  return sats;
}

/**
 * Parses a bitcoin or fiat typing draft into whole sats.
 *
 * @param unit - `btc` for digits-only sats, `fiat` for up to eight decimal places.
 * @param draft - Raw field value.
 * @param day - Gift day used for fiat conversion, or `null`.
 * @param code - Preferred fiat.
 * @returns `empty` when blank, `invalid` when the draft or rate cannot be used,
 *   or `sats` (including 0; callers still clamp).
 */
export function parseAmountDraft(
  unit: 'btc' | 'fiat',
  draft: string,
  day: FiatRateDay | null,
  code: FiatCode,
): AmountDraft {
  const trimmed = draft.trim();
  if (trimmed === '') {
    return { kind: 'empty' };
  }
  if (unit === 'btc') {
    if (!/^\d+$/.test(trimmed)) {
      return { kind: 'invalid' };
    }
    const sats = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(sats)) {
      return { kind: 'invalid' };
    }
    return { kind: 'sats', sats };
  }
  if (!FIAT_DRAFT.test(trimmed)) {
    return { kind: 'invalid' };
  }
  const normalized = trimmed.replace(',', '.');
  const numeric = normalized.endsWith('.') ? normalized.slice(0, -1) : normalized;
  const amount = Number(numeric);
  if (!Number.isFinite(amount)) {
    return { kind: 'invalid' };
  }
  const sats = fiatToSats(amount, day, code);
  if (sats === null) {
    return { kind: 'invalid' };
  }
  return { kind: 'sats', sats };
}

/**
 * Reply and inbox amount: blank stays blank, and 0 is billed as 1 sat.
 *
 * @param draft - Raw field value.
 * @param unit - Active typing unit.
 * @param day - Gift day, or `null`.
 * @param code - Preferred fiat.
 * @returns Whole sats, `empty`, or `invalid`.
 */
export function replySatsFromDraft(
  draft: string,
  unit: 'btc' | 'fiat',
  day: FiatRateDay | null,
  code: FiatCode,
): number | 'empty' | 'invalid' {
  const parsed = parseAmountDraft(unit, draft, day, code);
  if (parsed.kind !== 'sats') {
    return parsed.kind;
  }
  return parsed.sats < 1 ? 1 : parsed.sats;
}

/**
 * Pay-sheet amount. A blank field is 21 sats in either unit.
 *
 * @param draft - Raw field value.
 * @param unit - Active typing unit.
 * @param day - Gift day, or `null`.
 * @param code - Preferred fiat.
 * @returns Whole sats, or `invalid`.
 */
export function paySatsFromDraft(
  draft: string,
  unit: 'btc' | 'fiat',
  day: FiatRateDay | null,
  code: FiatCode,
): number | 'invalid' {
  const parsed = parseAmountDraft(unit, draft, day, code);
  if (parsed.kind === 'empty') {
    return 21;
  }
  if (parsed.kind !== 'sats' || parsed.sats < 1) {
    return 'invalid';
  }
  return parsed.sats;
}
