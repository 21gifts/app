import {
  DEFAULT_NUMBER_FORMAT,
  formatGroupedNumber,
  separatorsFor,
  type NumberFormatStyle,
} from '@/lib/number-format';

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
  return `$${formatGroupedNumber(Number(usd), style, 2)}`;
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
  if (usd === 0) {
    return '$0';
  }
  if (usd < 10) {
    const trimmed = usd.toFixed(2).replace(/\.?0+$/, '');
    const decimal = separatorsFor(style).decimal;
    return `$${trimmed.replace('.', decimal)}`;
  }
  return `$${formatGroupedNumber(Math.round(usd), style, 0)}`;
}
