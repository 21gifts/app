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
 * Formats a BTC axis tick, trimming trailing zeros (up to 8 dp).
 *
 * @param btc - Parsed BTC amount used for chart scale only.
 * @returns Trimmed decimal string (e.g. `0.015`).
 */
export function formatBtcTick(btc: number): string {
  if (btc === 0) {
    return '0';
  }
  return btc.toFixed(8).replace(/\.?0+$/, '');
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

/**
 * Formats a sat axis tick with grouping and no unit suffix.
 *
 * @param sats - Sat amount used for chart scale only.
 * @returns Grouped decimal string (e.g. `1,000`); `0` for zero.
 */
export function formatSatTick(sats: number): string {
  if (sats === 0) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(sats);
}
