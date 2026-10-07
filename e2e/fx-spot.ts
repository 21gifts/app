import type { Page } from '@playwright/test';

/** Prices of 1 BTC by fiat code, as `GET /fx/spot` returns them. */
export type SpotRates = Partial<Record<'USD' | 'CHF' | 'EUR' | 'PHP', string>>;

/** The rate most fixtures use: 1 BTC is $100'000, CHF 80'000, EUR 90'000, ₱5'600'000. */
export const SPOT_RATES: SpotRates = {
  USD: '100000.00',
  CHF: '80000.00',
  EUR: '90000.00',
  PHP: '5600000.00',
};

/** One gift day of a `GET /gifts/stats` fixture. */
type StatsDay = {
  sats: number;
  usd: string;
  chf?: string | null;
  eur?: string | null;
  php?: string | null;
};

/**
 * The spot prices equal to the last gift day with sats in a stats fixture,
 * so a screen that used that day shows the same fiat with the spot rate.
 */
export function spotRatesFromStats(stats: { spendOverTime?: readonly StatsDay[] }): SpotRates {
  const day = [...(stats.spendOverTime ?? [])].reverse().find((row) => row.sats > 0);
  if (day === undefined) {
    return {};
  }
  const perBtc = (amount: string | null | undefined): string | undefined =>
    amount === null || amount === undefined
      ? undefined
      : ((Number(amount) * 100_000_000) / day.sats).toFixed(8);
  const rates: SpotRates = {};
  for (const [code, amount] of [
    ['USD', day.usd],
    ['CHF', day.chf],
    ['EUR', day.eur],
    ['PHP', day.php],
  ] as const) {
    const price = perBtc(amount);
    if (price !== undefined) {
      rates[code] = price;
    }
  }
  return rates;
}

/** Answers `GET /fx/spot` with these prices; an empty object is the api's no-quote answer. */
export async function fulfillSpot(page: Page, rates: SpotRates = SPOT_RATES): Promise<void> {
  await page.route('**/fx/spot', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        Object.keys(rates).length === 0
          ? { asOf: null, source: null, rates }
          : { asOf: '2026-06-01T00:00:00.000Z', source: 'e2e', rates },
      ),
    });
  });
}
