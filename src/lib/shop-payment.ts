/**
 * The payment page's side of a shop payment (21gifts/api
 * `docs/shop-stablecoin-payment.md`, section "Payment page"): open one for an
 * entered amount, read the shop's pay link, fetch that payment's invoice, and
 * follow its status. The page never calls Orchestra and never records paid.
 */

/** The standard a pay link names when it carries a shop payment. */
const OPEN_CRYPTO_PAY = 'OpenCryptoPay';

/**
 * Limit of one `POST /pay/:username/payment` (ms). The api spends at most 8 s
 * on a creation, so an answer that takes longer is lost and counts as unknown.
 * Reaching the limit also aborts the request, which the api sees as a client
 * that disconnected: its creation then writes nothing, and none inserts a
 * payment more than 16 s after its request arrived.
 */
export const SHOP_PAYMENT_START_TIMEOUT_MS = 15_000;

/**
 * Time (ms) after the end of the most recent `POST /pay/:username/payment`
 * whose outcome stayed unknown before a refused call may read the pay link: by
 * then every creation the page started has inserted its payment or written
 * nothing, because none inserts more than 16 s after its request arrived.
 */
export const SHOP_PAYMENT_RECHECK_DELAY_MS = 20_000;

/** `paymentStatus` of a shop payment, as `GET /lnurlp/wait/:payment` reports it. */
export type ShopPaymentStatus = 'open' | 'accepted' | 'paid' | 'ended';

const SHOP_PAYMENT_STATUSES: readonly ShopPaymentStatus[] = ['open', 'accepted', 'paid', 'ended'];

/** One method and asset of a quote's `transferAmounts`. */
export interface ShopTransferLine {
  /** Method, e.g. `Polygon`. */
  method: string;
  /** Asset, e.g. `USDT`. */
  asset: string;
  /** Amount as the pay link writes it, e.g. `12.5`. */
  amount: string;
}

/** An OpenCryptoPay pay request for one shop payment. */
export interface ShopPayRequest {
  /** Callback URL for the transaction details. */
  callback: string;
  /** `quote.id`. */
  quoteId: string;
  /** `quote.expiration` (ISO 8601). */
  quoteExpiresAt: string;
  /** `quote.payment`: the shop payment id. */
  payment: string;
  /** Every method and asset of `transferAmounts` except the Lightning entry. */
  lines: ShopTransferLine[];
}

/** What the pay link answered. */
export type ShopPayLink =
  { kind: 'payment'; request: ShopPayRequest } | { kind: 'plain' } | { kind: 'error' };

/** Outcome of `POST /pay/:username/payment`. */
export type ShopPaymentStart =
  | { kind: 'opened'; payment: string; expiresAt: string | null }
  | { kind: 'charge' }
  | { kind: 'invoice' }
  | { kind: 'failed' };

/** What `openShopPayment` returns: the outcome, and the state the next call starts from. */
export interface ShopPaymentOpening {
  /** The outcome; `aborted` when `signal` aborted before there was one. */
  start: ShopPaymentStart | { kind: 'aborted' };
  /**
   * End (epoch ms) of the most recent call whose outcome stayed unknown, or
   * `null` once a call returned a payment or when none was unknown. Pass it to
   * the next call for the same pay link.
   */
  ambiguousAtMs: number | null;
}

/** Options of `openShopPayment`. */
export interface ShopPaymentOpenOptions {
  /** `ambiguousAtMs` of the previous call for this pay link, or `null` for none. */
  ambiguousAtMs: number | null;
  /** Aborts the requests and the wait when the page leaves the pay link. */
  signal: AbortSignal;
}

/** One answer of `GET /lnurlp/wait/:payment`. */
export interface ShopPaymentWait {
  /** DFX status: `Pending` until the payment is paid or closed. */
  status: string;
  /** The shop payment's own status. */
  paymentStatus: ShopPaymentStatus;
}

/** The named fields of a JSON object, or `null` when `value` is not one. */
function fields<K extends string>(value: unknown): { [P in K]?: unknown } | null {
  return value !== null && typeof value === 'object' ? (value as { [P in K]?: unknown }) : null;
}

type PayLinkField =
  | 'standard'
  | 'possibleStandards'
  | 'callback'
  | 'quote'
  | 'transferAmounts'
  | 'tag'
  | 'minSendable'
  | 'maxSendable'
  | 'metadata';

function isOpenCryptoPay(body: { [P in PayLinkField]?: unknown }): boolean {
  if (body.standard === OPEN_CRYPTO_PAY) {
    return true;
  }
  return Array.isArray(body.possibleStandards) && body.possibleStandards.includes(OPEN_CRYPTO_PAY);
}

/** Whether the body is a LUD-06 pay request: the plain Lightning request without a shop payment. */
function isPlainPayRequest(body: { [P in PayLinkField]?: unknown }): boolean {
  const { minSendable, maxSendable } = body;
  return (
    body.tag === 'payRequest' &&
    typeof body.callback === 'string' &&
    typeof body.metadata === 'string' &&
    typeof minSendable === 'number' &&
    typeof maxSendable === 'number' &&
    Number.isSafeInteger(minSendable) &&
    Number.isSafeInteger(maxSendable) &&
    minSendable > 0 &&
    minSendable <= maxSendable
  );
}

function transferLines(value: unknown): ShopTransferLine[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const lines: ShopTransferLine[] = [];
  for (const item of value) {
    const entry = fields<'method' | 'available' | 'assets'>(item);
    if (
      entry === null ||
      typeof entry.method !== 'string' ||
      entry.method === 'Lightning' ||
      entry.available === false ||
      !Array.isArray(entry.assets)
    ) {
      continue;
    }
    for (const assetItem of entry.assets) {
      const asset = fields<'asset' | 'amount'>(assetItem);
      if (
        asset !== null &&
        typeof asset.asset === 'string' &&
        (typeof asset.amount === 'string' || typeof asset.amount === 'number')
      ) {
        lines.push({ method: entry.method, asset: asset.asset, amount: String(asset.amount) });
      }
    }
  }
  return lines;
}

function readPayRequest(body: { [P in PayLinkField]?: unknown }): ShopPayRequest | null {
  const quote = fields<'id' | 'payment' | 'expiration'>(body.quote);
  if (
    typeof body.callback !== 'string' ||
    quote === null ||
    typeof quote.id !== 'string' ||
    typeof quote.payment !== 'string' ||
    typeof quote.expiration !== 'string' ||
    !Number.isFinite(Date.parse(quote.expiration))
  ) {
    return null;
  }
  return {
    callback: body.callback,
    quoteId: quote.id,
    quoteExpiresAt: quote.expiration,
    payment: quote.payment,
    lines: transferLines(body.transferAmounts),
  };
}

/**
 * Fetch the shop's pay link on this site's origin, without `timeout`, and read
 * whether it carries a shop payment.
 *
 * @param username - The shop's username.
 * @returns `payment` with the OpenCryptoPay pay request, `plain` for the plain
 *   Lightning pay request (`tag` `payRequest`, a `callback`, whole
 *   `minSendable` above 0 and `maxSendable` not below it, and `metadata`), or
 *   `error` for a failed request, an error status, an unreadable body, any
 *   other body, or an OpenCryptoPay body without a usable quote.
 */
export async function fetchShopPayLink(username: string): Promise<ShopPayLink> {
  try {
    const response = await fetch(`/.well-known/lnurlp/${encodeURIComponent(username)}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return { kind: 'error' };
    }
    const body = fields<PayLinkField>(await response.json());
    if (body === null) {
      return { kind: 'error' };
    }
    if (!isOpenCryptoPay(body)) {
      return isPlainPayRequest(body) ? { kind: 'plain' } : { kind: 'error' };
    }
    const request = readPayRequest(body);
    return request === null ? { kind: 'error' } : { kind: 'payment', request };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * Fetch the BOLT11 of a shop payment from the callback's Lightning detail
 * (`<callback>?quote=<id>&method=Lightning&asset=BTC`). Never mints.
 *
 * @param request - The pay request whose current quote names the payment.
 * @returns The payment request, or `null` when it could not be read.
 */
export async function fetchShopInvoice(request: ShopPayRequest): Promise<string | null> {
  try {
    const url = new URL(request.callback);
    url.searchParams.set('quote', request.quoteId);
    url.searchParams.set('method', 'Lightning');
    url.searchParams.set('asset', 'BTC');
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const body = fields<'pr'>(await response.json());
    return body !== null && typeof body.pr === 'string' && body.pr !== '' ? body.pr : null;
  } catch {
    return null;
  }
}

async function errorCode(response: Response): Promise<unknown> {
  try {
    return fields<'code'>(await response.json())?.code;
  } catch {
    return undefined;
  }
}

/**
 * One answer of `POST /pay/:username/payment`: a payment, a pending till charge,
 * `refused` (503 `stablecoin_unavailable` or another 4xx: no payment was
 * opened), `unknown` when its outcome cannot be known, or `aborted` when the
 * page left.
 */
type ShopPaymentAttempt =
  | { kind: 'opened'; payment: string; expiresAt: string | null }
  | { kind: 'charge' }
  | 'refused'
  | 'unknown'
  | 'aborted';

/** One `POST /pay/:username/payment`, until its time limit or until `signal` aborts. */
async function attemptShopPayment(
  username: string,
  amountSats: number,
  signal: AbortSignal,
): Promise<ShopPaymentAttempt> {
  if (signal.aborted) {
    return 'aborted';
  }
  // A timer, not `AbortSignal.timeout`, which older Safari versions do not have.
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SHOP_PAYMENT_START_TIMEOUT_MS);
  const leave = (): void => {
    controller.abort();
  };
  signal.addEventListener('abort', leave);
  try {
    const attempt = await readShopPaymentStart(username, amountSats, controller.signal);
    return signal.aborted ? 'aborted' : attempt;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', leave);
  }
}

/** The request and the reading of one `POST /pay/:username/payment`, until `signal` aborts. */
async function readShopPaymentStart(
  username: string,
  amountSats: number,
  signal: AbortSignal,
): Promise<Exclude<ShopPaymentAttempt, 'aborted'>> {
  let response: Response;
  try {
    response = await fetch(`/pay/${encodeURIComponent(username)}/payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats }),
      signal,
    });
  } catch {
    return 'unknown';
  }
  if (response.ok) {
    try {
      const body = fields<'payment' | 'expiresAt'>(await response.json());
      if (body !== null && typeof body.payment === 'string' && body.payment !== '') {
        // The id is that payment; repeating the call would replace it.
        const expiresAt =
          typeof body.expiresAt === 'string' && Number.isFinite(Date.parse(body.expiresAt))
            ? body.expiresAt
            : null;
        return { kind: 'opened', payment: body.payment, expiresAt };
      }
    } catch {
      // An unreadable success leaves open whether a payment was opened.
    }
    return 'unknown';
  }
  if (response.status === 409 && (await errorCode(response)) === 'payment_open') {
    return { kind: 'charge' };
  }
  if (response.status >= 400 && response.status < 500) {
    return 'refused';
  }
  if (response.status === 503 && (await errorCode(response)) === 'stablecoin_unavailable') {
    return 'refused';
  }
  return 'unknown';
}

/** Resolves after `ms`, or at once when `signal` aborts. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}

/**
 * Open a shop payment for an amount the payer entered
 * (`POST /pay/:username/payment`), as the contract's "Payment page" says.
 *
 * A failed request, a request that reaches `SHOP_PAYMENT_START_TIMEOUT_MS`, a
 * success without a usable payment id, or a 5xx other than
 * `stablecoin_unavailable` leaves open whether a payment was opened. The first
 * such outcome is repeated once with the same body; a new payer amount
 * replaces any payment the lost answer opened. From then on, until a call
 * returns a payment, the page is in the ambiguous state (`ambiguousAtMs` set),
 * and this call and every later one, for any amount, are handled as follows:
 * a payment ends the state; a 409 `payment_open` is `charge`; a 503
 * `stablecoin_unavailable` or another 4xx reads the pay link once at least
 * `SHOP_PAYMENT_RECHECK_DELAY_MS` have passed since `ambiguousAtMs`, and only
 * the plain Lightning request (no open amount) is `invoice`, while a pay
 * request or a failed read is `failed`; another unknown outcome moves
 * `ambiguousAtMs` to its end and is `failed`. An abort repeats nothing and
 * reads no pay link.
 *
 * @param username - The shop's username.
 * @param amountSats - Whole sats the payer entered.
 * @param options - The previous call's `ambiguousAtMs` and the page's abort signal.
 * @returns The outcome and the `ambiguousAtMs` for the next call. `opened` has
 *   the payment id and its window end (`null` when the answer had no readable
 *   `expiresAt`); `charge` means a till charge is pending (reload it);
 *   `invoice` means mint with `POST /pay/:username/invoice`; `failed` means
 *   show the start error and mint nothing; `aborted` means the page left.
 */
export async function openShopPayment(
  username: string,
  amountSats: number,
  options: ShopPaymentOpenOptions,
): Promise<ShopPaymentOpening> {
  const { signal } = options;
  let ambiguousAtMs = options.ambiguousAtMs;
  let attempt = await attemptShopPayment(username, amountSats, signal);
  if (ambiguousAtMs === null) {
    if (attempt === 'aborted') {
      return { start: { kind: 'aborted' }, ambiguousAtMs };
    }
    if (attempt === 'refused') {
      return { start: { kind: 'invoice' }, ambiguousAtMs };
    }
    if (attempt !== 'unknown') {
      return { start: attempt, ambiguousAtMs };
    }
    ambiguousAtMs = Date.now();
    attempt = await attemptShopPayment(username, amountSats, signal);
  }
  if (attempt === 'aborted') {
    return { start: { kind: 'aborted' }, ambiguousAtMs };
  }
  if (attempt === 'unknown') {
    return { start: { kind: 'failed' }, ambiguousAtMs: Date.now() };
  }
  if (attempt !== 'refused') {
    // A payment ends the ambiguous state; a pending till charge leaves it as it is.
    return { start: attempt, ambiguousAtMs: attempt.kind === 'opened' ? null : ambiguousAtMs };
  }
  await pause(Math.max(0, ambiguousAtMs + SHOP_PAYMENT_RECHECK_DELAY_MS - Date.now()), signal);
  if (signal.aborted) {
    return { start: { kind: 'aborted' }, ambiguousAtMs };
  }
  const link = await fetchShopPayLink(username);
  if (signal.aborted) {
    return { start: { kind: 'aborted' }, ambiguousAtMs };
  }
  return { start: { kind: link.kind === 'plain' ? 'invoice' : 'failed' }, ambiguousAtMs };
}

/**
 * Ask `GET /lnurlp/wait/:payment` for a shop payment's status. With `since`,
 * the api waits while the status still equals it.
 *
 * @param payment - Shop payment id.
 * @param since - The last `paymentStatus` seen, or `null` for the first call.
 * @param signal - Aborts the request when the page leaves the payment.
 * @returns The status; `missing` for a 404 with the api's error body
 *   (`status` `ERROR`, `reason` `Not found`), when the api does not know this
 *   payment; `null` for any other 404 or error status, a failed request, or an
 *   unreadable answer.
 */
export async function waitShopPayment(
  payment: string,
  since: ShopPaymentStatus | null,
  signal?: AbortSignal,
): Promise<ShopPaymentWait | 'missing' | null> {
  const query = since === null ? '' : `?since=${since}`;
  try {
    const response = await fetch(`/lnurlp/wait/${encodeURIComponent(payment)}${query}`, {
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    });
    if (response.status === 404) {
      // Only the api's own error body says it does not know the payment; another 404
      // (for example a page that did not reach the api) is read again.
      const error = fields<'status' | 'reason'>(await response.json());
      return error?.status === 'ERROR' && error.reason === 'Not found' ? 'missing' : null;
    }
    if (!response.ok) {
      return null;
    }
    const body = fields<'status' | 'paymentStatus'>(await response.json());
    if (
      body === null ||
      typeof body.status !== 'string' ||
      !SHOP_PAYMENT_STATUSES.includes(body.paymentStatus as ShopPaymentStatus)
    ) {
      return null;
    }
    return { status: body.status, paymentStatus: body.paymentStatus as ShopPaymentStatus };
  } catch {
    return null;
  }
}
