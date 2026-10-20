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

/** Sats of the till's charge on `GET /pay/ada`. */
const TILL_SATS = 238_093;

/** The stablecoin entries of the till's quote (`TILL_SATS`) in `transferAmounts`. */
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

/** The stub's price of one bitcoin in USD, the suite's spot rate (`100000.00`). */
const USD_PER_BTC = 100_000;

/**
 * A whole-sat amount in BTC as the api writes it: eight decimals, then trailing zeros and a
 * trailing point dropped (`21` → `0.00000021`, `100000000` → `1`).
 */
function btcAmount(sats: number): string {
  return (sats / 100_000_000).toFixed(8).replace(/\.?0+$/, '');
}

/**
 * The stablecoin entries of a payer's amount: every method and asset of `STABLECOIN_AMOUNTS`
 * for the sats' USD value at `USD_PER_BTC`, with six decimals at most and no trailing zero
 * (`12500` → `12.5`, `21` → `0.021`).
 */
function stablecoinAmounts(sats: number): typeof STABLECOIN_AMOUNTS {
  const usd = ((sats * USD_PER_BTC) / 100_000_000).toFixed(6).replace(/\.?0+$/, '');
  return STABLECOIN_AMOUNTS.map((entry) => ({
    ...entry,
    assets: entry.assets.map((asset) => ({ ...asset, amount: usd })),
  }));
}

/** The BOLT11 of a shop payment for `sats`, its amount in nano-bitcoin as BOLT11 writes it. */
function shopInvoice(sats: number): string {
  return `lnbc${sats * 10}n1shop`;
}

/** One answer of `GET /lnurlp/wait/:payment`. */
export interface ShopWaitAnswer {
  status: string;
  paymentStatus: string;
  /**
   * When the status changes to this entry, on the page's clock. Until then the api holds a
   * read whose `since` is the previous entry's status; without it the change is already there.
   */
  at?: string;
}

/** How often a held wait read looks at the page's clock again, in real time. */
const HELD_READ_CHECK_MS = 50;

/**
 * Resolves once the page's clock reaches `at`, or `false` when the page closed first.
 *
 * @param page - The page whose clock counts.
 * @param at - The time on the page's clock.
 */
async function pageReaches(page: Page, at: number): Promise<boolean> {
  for (;;) {
    let now: number;
    try {
      now = await pageNow(page);
    } catch {
      return false;
    }
    if (now >= at) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, HELD_READ_CHECK_MS));
  }
}

/**
 * One scripted answer of `POST /pay/ada/payment`: `opened`, an HTTP status, or
 * `hang`, which never answers, so the page's 15 s limit aborts the request.
 */
export type ShopPostAnswer = 'opened' | 'hang' | 400 | 409 | 502 | 503;

/** One scripted answer of the pay link: an open amount, the plain request, or 503. */
export type ShopPayLinkAnswer = 'payment' | 'plain' | 'error';

/** Never settles, as a request the server holds or never answers. */
function never(): Promise<void> {
  return new Promise(() => undefined);
}

/** The JSON body of a scripted `POST /pay/ada/payment` error status. */
function postErrorBody(status: Exclude<ShopPostAnswer, 'opened' | 'hang'>): object {
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
 *   Lightning only) for the till's 238'093 sats, or, once an `opened` answer
 *   came, for the `amountSats` of that post, as the api builds it: the
 *   Lightning entry and `requestedAmount` are those sats in BTC,
 *   `minSendable` and `maxSendable` those sats times 1000, and every
 *   stablecoin line their USD value at 100'000 USD per bitcoin (12'500 sats
 *   are `12.5`). Its quote stays the same until its expiration on the
 *   page's clock, then one new quote id with the same `quote.payment` lasts
 *   another 90 s. After a 503 `stablecoin_unavailable` or another non-409 4xx
 *   it is the plain Lightning request, and the mint answers today's invoice.
 * - The callback answers `{ pr }` only for `method=Lightning&asset=BTC` and the
 *   current or previous quote whose expiration has not passed, 404 for any
 *   other quote, and 400 otherwise. `pr` names the pay link's sats
 *   (`lnbc2380930n1shop` for the till, `lnbc210n1shop` for 21 sats).
 * - `GET /lnurlp/wait/p1` answers the current entry of `waits`; a `since` equal
 *   to its `paymentStatus` moves to the next entry, held until the page's clock
 *   reaches that entry's `at`.
 * - `payLinks` scripts the pay-link reads in turn (the last one repeated):
 *   `payment` is the OpenCryptoPay request above, `plain` the plain Lightning
 *   request, and `error` a 503; without it the reads follow the rules above.
 * - `payLinkFails` answers every pay-link read with 503, and `detailFails`
 *   every Lightning detail; `detailHangs` never answers the Lightning detail.
 *   `openedWithoutWindow` opens the payment without `expiresAt`, so the page
 *   has no window time to show.
 * - `GET /lnurlp/wait/p1` with a `since` equal to the last entry's
 *   `paymentStatus` is held and never answered, as the api holds it while the
 *   status is unchanged.
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
    payLinkFails?: boolean;
    payLinks?: ShopPayLinkAnswer[];
    detailFails?: boolean;
    detailHangs?: boolean;
    openedWithoutWindow?: boolean;
  },
): Promise<void> {
  const posts = options.posts ?? [options.charge === true ? 409 : 'opened'];
  let post = 0;
  let till = options.charge === true;
  // The sats of the most recent `opened` post: from then on the pay link is that payer's amount.
  let openedSats: number | null = null;
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
        if (answer === 'hang') {
          await never();
          return;
        }
        if (answer === 'opened') {
          const posted = JSON.parse(route.request().postData() ?? '{}') as { amountSats?: number };
          openedSats = posted.amountSats ?? null;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              options.openedWithoutWindow === true
                ? { payment: 'p1' }
                : { payment: 'p1', expiresAt: '2026-09-24T12:05:00.000Z' },
            ),
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
          minSats: till ? TILL_SATS : 1,
          maxSats: till ? TILL_SATS : 100000000,
          charge: till ? { amountSats: TILL_SATS, expiresAt: '2026-09-24T12:05:00.000Z' } : null,
        }),
      });
    },
  );
  const issued: { id: string; expiration: number }[] = [];
  let payLinkRead = 0;
  await page.route('**/.well-known/lnurlp/ada', async (route) => {
    const scripted =
      options.payLinks === undefined
        ? undefined
        : options.payLinks[Math.min(payLinkRead, options.payLinks.length - 1)];
    payLinkRead += 1;
    if (options.payLinkFails === true || scripted === 'error') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return;
    }
    if (scripted === 'plain' || (scripted === undefined && plain)) {
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
    const sats = openedSats ?? TILL_SATS;
    const stablecoins = openedSats === null ? STABLECOIN_AMOUNTS : stablecoinAmounts(openedSats);
    const body = JSON.stringify({
      tag: 'payRequest',
      callback: 'https://21.gifts/lnurlp/cb/ada',
      minSendable: sats * 1000,
      maxSendable: sats * 1000,
      standard: 'OpenCryptoPay',
      possibleStandards: ['OpenCryptoPay'],
      quote: {
        id: quote.id,
        expiration: new Date(quote.expiration).toISOString(),
        payment: options.payLinkPayment ?? 'p1',
      },
      requestedAmount: { asset: 'BTC', amount: '<requested>' },
      transferAmounts: [
        {
          method: 'Lightning',
          minFee: 0,
          assets: [{ asset: 'BTC', amount: btcAmount(sats) }],
          available: true,
        },
        ...(options.lightningOnly === true ? [] : stablecoins),
      ],
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // `requestedAmount.amount` is a JSON number in plain notation, never `2.1e-7`.
      body: body.replace('"<requested>"', btcAmount(sats)),
    });
  });
  await page.route(
    (url) => new URL(url).pathname === '/lnurlp/cb/ada',
    async (route) => {
      if (options.detailHangs === true) {
        await never();
        return;
      }
      const query = new URL(route.request().url()).searchParams;
      const id = query.get('quote');
      const lightning = query.get('method') === 'Lightning' && query.get('asset') === 'BTC';
      // The current or the previous quote, while its own expiration has not passed.
      const now = await pageNow(page);
      const known = issued.slice(-2).some((quote) => quote.id === id && quote.expiration > now);
      const status =
        options.detailFails === true ? 503 : id === null || !lightning ? 400 : known ? 200 : 404;
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(
          status === 200
            ? { pr: shopInvoice(openedSats ?? TILL_SATS) }
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
    if (since !== null && since === waits[wait]?.paymentStatus) {
      if (wait === waits.length - 1) {
        // The status is unchanged: the api holds the read, and the page asks only once.
        await never();
        return;
      }
      const at = waits[wait + 1]?.at;
      // The api holds the read while the status is unchanged, until the change at `at`.
      if (at !== undefined && !(await pageReaches(page, Date.parse(at)))) {
        return;
      }
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
