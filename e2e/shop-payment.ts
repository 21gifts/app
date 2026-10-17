/**
 * Playwright stubs for the payment page's shop payment (21gifts/api
 * `docs/shop-stablecoin-payment.md`, "Payment page"). The clock of the tests
 * that use them is 2026-09-24T12:00:00Z.
 */
import type { Page, Route } from '@playwright/test';

/** `POST /pay/:username/payment` without stablecoin rows: the page mints as before. */
export async function fulfillStablecoinUnavailable(route: Route): Promise<void> {
  await route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'Stablecoin payment is unavailable',
      code: 'stablecoin_unavailable',
    }),
  });
}

/**
 * Pay link `ada` with the shop payment `p1`: `GET /pay/ada` (with or without
 * an open till), `POST /pay/ada/payment`, the OpenCryptoPay pay request, the
 * callback's Lightning detail, and `GET /lnurlp/wait/p1`. A mint answers 500,
 * because a shop payment is never minted.
 */
export async function stubShopPayment(
  page: Page,
  options: {
    paymentStatus?: string;
    status?: string;
    charge?: boolean;
    payLinkPayment?: string;
    start?: 'opened' | 'failed';
  },
): Promise<void> {
  await page.route(
    (url) => new URL(url).pathname.startsWith('/pay/'),
    async (route) => {
      const url = route.request().url();
      if (url.endsWith('/payment')) {
        if (options.start === 'failed') {
          await route.fulfill({ status: 502, contentType: 'application/json', body: '{}' });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ payment: 'p1', expiresAt: '2026-09-24T12:05:00.000Z' }),
        });
        return;
      }
      if (url.includes('/invoice')) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada Lovelace',
          username: 'ada',
          minSats: options.charge === true ? 238093 : 1,
          maxSats: options.charge === true ? 238093 : 100000000,
          charge:
            options.charge === true
              ? { amountSats: 238093, expiresAt: '2026-09-24T12:05:00.000Z' }
              : null,
        }),
      });
    },
  );
  await page.route('**/.well-known/lnurlp/ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tag: 'payRequest',
        callback: 'https://21.gifts/lnurlp/cb/ada',
        standard: 'OpenCryptoPay',
        possibleStandards: ['OpenCryptoPay'],
        quote: {
          id: 'q1',
          expiration: '2026-09-24T12:01:30.000Z',
          payment: options.payLinkPayment ?? 'p1',
        },
        transferAmounts: [
          {
            method: 'Lightning',
            minFee: 0,
            assets: [{ asset: 'BTC', amount: '0.00238093' }],
            available: true,
          },
          {
            method: 'Polygon',
            minFee: 36,
            assets: [
              { asset: 'USDT', amount: '238.21' },
              { asset: 'USDC', amount: '238.2' },
            ],
            available: true,
          },
          {
            method: 'Arbitrum',
            minFee: 12,
            assets: [{ asset: 'USDT', amount: '238.19' }],
            available: true,
          },
        ],
      }),
    });
  });
  await page.route(
    (url) => new URL(url).pathname === '/lnurlp/cb/ada',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ pr: 'lnbc2380930n1shop' }),
      });
    },
  );
  await page.route('**/lnurlp/wait/p1**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: options.status ?? 'Pending',
        paymentStatus: options.paymentStatus ?? 'open',
      }),
    });
  });
}
