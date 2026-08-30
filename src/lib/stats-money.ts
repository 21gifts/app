/**
 * Formats an API USD amount string for hero display.
 *
 * @param usd - Two-decimal USD string from the api (e.g. `"1425.00"`).
 * @returns Locale currency string such as `$1,425.00`.
 */
export function formatUsdDisplay(usd: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(usd));
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
 * Formats a USD axis tick with grouping and a dollar prefix.
 *
 * @param usd - Parsed USD amount used for chart scale only.
 * @returns Label such as `$1,234`.
 */
export function formatUsdTick(usd: number): string {
  if (usd === 0) {
    return '$0';
  }
  if (usd < 10) {
    return `$${usd.toFixed(2).replace(/\.?0+$/, '')}`;
  }
  return `$${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(usd))}`;
}
