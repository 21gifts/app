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

/** The stablecoin entries of the quote's `transferAmounts`. */
const STABLECOIN_AMOUNTS = [
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
];

/** One answer of `GET /lnurlp/wait/:payment`. */
export interface ShopWaitAnswer {
  status: string;
  paymentStatus: string;
}

/** One scripted answer of `POST /pay/ada/payment`: `opened` or an HTTP status. */
export type ShopPostAnswer = 'opened' | 400 | 409 | 502 | 503;

/** The JSON body of a scripted `POST /pay/ada/payment` error status. */
function postErrorBody(status: Exclude<ShopPostAnswer, 'opened'>): object {
  if (status === 409) {
    return { error: 'A payment is already open', code: 'payment_open' };
  }
  if (status === 503) {
    return { error: 'Stablecoin payment is unavailable', code: 'stablecoin_unavailable' };
  }
  return status === 400 ? { error: 'Enter a whole number of sats' } : {};
}

/** Lifetime of a stubbed quote; the first one expires at 12:01:30 on the suite clock. */
const QUOTE_LIFETIME_MS = 90_000;

/** The page's own clock (`page.clock`), which the route handlers cannot read directly. */
async function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

/**
 * Pay link `ada` with the shop payment `p1`, as the api answers it:
 *
 * - `GET /pay/ada` carries an open till with `charge`, and from the request
 *   after a 409 on.
 * - `POST /pay/ada/payment` answers `posts` in turn (the last one repeated):
 *   `opened` is `{ payment: 'p1', expiresAt }`; 409 `payment_open` is the
 *   default with `charge`, and it opens the till for the next `GET /pay/ada`.
 * - The pay link is the OpenCryptoPay pay request (with stablecoin lines, or
 *   Lightning only). Its quote stays the same until its expiration on the
 *   page's clock, then one new quote id with the same `quote.payment` lasts
 *   another 90 s. After a 503 `stablecoin_unavailable` or another non-409 4xx
 *   it is the plain Lightning request, and the mint answers today's invoice.
 * - The callback answers `{ pr }` only for `method=Lightning&asset=BTC` and the
 *   current or previous quote whose expiration has not passed, 404 for any
 *   other quote, and 400 otherwise.
 * - `GET /lnurlp/wait/p1` answers the current entry of `waits`; a `since` equal
 *   to its `paymentStatus` moves to the next entry (the last one repeats).
 * - Otherwise a mint answers 500, because a shop payment, or a repeat whose
 *   outcome stayed unknown, is never minted.
 */
export async function stubShopPayment(
  page: Page,
  options: {
    paymentStatus?: string;
    status?: string;
    charge?: boolean;
    payLinkPayment?: string;
    posts?: ShopPostAnswer[];
    lightningOnly?: boolean;
    waits?: ShopWaitAnswer[];
  },
): Promise<void> {
  const posts = options.posts ?? [options.charge === true ? 409 : 'opened'];
  let post = 0;
  let till = options.charge === true;
  // A 503 `stablecoin_unavailable` or another non-409 4xx opens no shop payment: the pay
  // link stays the plain Lightning request and the page mints as today.
  let plain = false;
  await page.route(
    (url) => new URL(url).pathname.startsWith('/pay/'),
    async (route) => {
      const url = route.request().url();
      if (url.endsWith('/payment')) {
        const answer = posts[Math.min(post, posts.length - 1)] ?? 'opened';
        post += 1;
        if (answer === 'opened') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ payment: 'p1', expiresAt: '2026-09-24T12:05:00.000Z' }),
          });
          return;
        }
        if (answer === 409) {
          till = true;
        }
        if (answer === 400 || answer === 503) {
          plain = true;
        }
        await route.fulfill({
          status: answer,
          contentType: 'application/json',
          body: JSON.stringify(postErrorBody(answer)),
        });
        return;
      }
      if (url.includes('/invoice')) {
        if (!plain) {
          // A tripwire: a shop payment, or a repeat whose outcome stayed unknown, never mints.
          await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
          return;
        }
        const body = JSON.parse(route.request().postData() ?? '{}') as { amountSats?: number };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ pr: 'lnbc210n1plain', amountSats: body.amountSats ?? 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Ada Lovelace',
          username: 'ada',
          minSats: till ? 238093 : 1,
          maxSats: till ? 238093 : 100000000,
          charge: till ? { amountSats: 238093, expiresAt: '2026-09-24T12:05:00.000Z' } : null,
        }),
      });
    },
  );
  const issued: { id: string; expiration: number }[] = [];
  await page.route('**/.well-known/lnurlp/ada', async (route) => {
    if (plain) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tag: 'payRequest',
          callback: 'https://21.gifts/lnurlp/ada/invoice',
          minSendable: 1_000,
          maxSendable: 100_000_000_000,
          metadata: '[["text/plain","Ada Lovelace"]]',
        }),
      });
      return;
    }
    const now = await pageNow(page);
    const current = issued.at(-1);
    if (current === undefined) {
      const first = Date.parse('2026-09-24T12:01:30.000Z');
      issued.push({ id: 'q1', expiration: first > now ? first : now + QUOTE_LIFETIME_MS });
    } else if (current.expiration <= now) {
      // The quote is replaced once its expiration has passed, and not before.
      issued.push({ id: `q${issued.length + 1}`, expiration: now + QUOTE_LIFETIME_MS });
    }
    const quote = issued.at(-1) ?? { id: 'q1', expiration: 0 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tag: 'payRequest',
        callback: 'https://21.gifts/lnurlp/cb/ada',
        standard: 'OpenCryptoPay',
        possibleStandards: ['OpenCryptoPay'],
        quote: {
          id: quote.id,
          expiration: new Date(quote.expiration).toISOString(),
          payment: options.payLinkPayment ?? 'p1',
        },
        transferAmounts: [
          {
            method: 'Lightning',
            minFee: 0,
            assets: [{ asset: 'BTC', amount: '0.00238093' }],
            available: true,
          },
          ...(options.lightningOnly === true ? [] : STABLECOIN_AMOUNTS),
        ],
      }),
    });
  });
  await page.route(
    (url) => new URL(url).pathname === '/lnurlp/cb/ada',
    async (route) => {
      const query = new URL(route.request().url()).searchParams;
      const id = query.get('quote');
      const lightning = query.get('method') === 'Lightning' && query.get('asset') === 'BTC';
      // The current or the previous quote, while its own expiration has not passed.
      const now = await pageNow(page);
      const known = issued.slice(-2).some((quote) => quote.id === id && quote.expiration > now);
      const status = id === null || !lightning ? 400 : known ? 200 : 404;
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(
          status === 200
            ? { pr: 'lnbc2380930n1shop' }
            : {
                status: 'ERROR',
                reason: status === 404 ? 'Quote expired' : 'That payment is not offered',
              },
        ),
      });
    },
  );
  const waits = options.waits ?? [
    { status: options.status ?? 'Pending', paymentStatus: options.paymentStatus ?? 'open' },
  ];
  let wait = 0;
  await page.route('**/lnurlp/wait/p1**', async (route) => {
    const since = new URL(route.request().url()).searchParams.get('since');
    if (since !== null && since === waits[wait]?.paymentStatus && wait < waits.length - 1) {
      wait += 1;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...waits[wait], invoiceExpiresAt: '2026-09-24T12:17:00.000Z' }),
    });
  });
}

/**
 * Pay link `ada` as the plain Lightning pay request (no shop payment), so an
 * open till mints its amount as before.
 */
export async function stubPlainPayLink(page: Page): Promise<void> {
  await page.route('**/.well-known/lnurlp/ada', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tag: 'payRequest',
        callback: 'https://21.gifts/lnurlp/ada/invoice',
        minSendable: 238_093_000,
        maxSendable: 238_093_000,
        metadata: '[["text/plain","Ada Lovelace"]]',
      }),
    });
  });
}
