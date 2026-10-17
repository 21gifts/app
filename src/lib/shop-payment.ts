/**
 * The payment page's side of a shop payment (21gifts/api
 * `docs/shop-stablecoin-payment.md`, section "Payment page"): open one for an
 * entered amount, read the shop's pay link, fetch that payment's invoice, and
 * follow its status. The page never calls Orchestra and never records paid.
 */

/** The standard a pay link names when it carries a shop payment. */
const OPEN_CRYPTO_PAY = 'OpenCryptoPay';

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
  | { kind: 'opened'; payment: string; expiresAt: string }
  | { kind: 'charge' }
  | { kind: 'invoice' }
  | { kind: 'failed' };

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

type PayLinkField = 'standard' | 'possibleStandards' | 'callback' | 'quote' | 'transferAmounts';

function isOpenCryptoPay(body: { [P in PayLinkField]?: unknown }): boolean {
  if (body.standard === OPEN_CRYPTO_PAY) {
    return true;
  }
  return Array.isArray(body.possibleStandards) && body.possibleStandards.includes(OPEN_CRYPTO_PAY);
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
 *   Lightning pay request, or `error` for a failed request, an error status, an
 *   unreadable body, or an OpenCryptoPay body without a usable quote.
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
      return { kind: 'plain' };
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

/** One `POST /pay/:username/payment`; `unknown` when its outcome cannot be known. */
async function attemptShopPayment(
  username: string,
  amountSats: number,
): Promise<ShopPaymentStart | 'unknown'> {
  let response: Response;
  try {
    response = await fetch(`/pay/${encodeURIComponent(username)}/payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats }),
    });
  } catch {
    return 'unknown';
  }
  if (response.ok) {
    try {
      const body = fields<'payment' | 'expiresAt'>(await response.json());
      if (
        body !== null &&
        typeof body.payment === 'string' &&
        body.payment !== '' &&
        typeof body.expiresAt === 'string' &&
        Number.isFinite(Date.parse(body.expiresAt))
      ) {
        return { kind: 'opened', payment: body.payment, expiresAt: body.expiresAt };
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
    return { kind: 'invoice' };
  }
  if (response.status === 503 && (await errorCode(response)) === 'stablecoin_unavailable') {
    return { kind: 'invoice' };
  }
  return 'unknown';
}

/**
 * Open a shop payment for an amount the payer entered
 * (`POST /pay/:username/payment`). A failed request, an unreadable success, or
 * a 5xx other than `stablecoin_unavailable` leaves open whether a payment was
 * opened, so the same call is repeated once.
 *
 * @param username - The shop's username.
 * @param amountSats - Whole sats the payer entered.
 * @returns `opened` with the payment id and its window end; `charge` on 409
 *   `payment_open` (a till charge is pending); `invoice` on 503
 *   `stablecoin_unavailable` or any other 4xx (mint with
 *   `POST /pay/:username/invoice` instead), only on the first answer; `failed`
 *   when the repeat was unknown too, or answered 503 `stablecoin_unavailable`
 *   or another 4xx, because the lost first answer may have opened a payment
 *   (show the error, do not mint).
 */
export async function openShopPayment(
  username: string,
  amountSats: number,
): Promise<ShopPaymentStart> {
  const first = await attemptShopPayment(username, amountSats);
  if (first !== 'unknown') {
    return first;
  }
  // The lost first answer may have opened a payment, so the repeat never mints.
  const second = await attemptShopPayment(username, amountSats);
  return second === 'unknown' || second.kind === 'invoice' ? { kind: 'failed' } : second;
}

/**
 * Ask `GET /lnurlp/wait/:payment` for a shop payment's status. With `since`,
 * the api waits while the status still equals it.
 *
 * @param payment - Shop payment id.
 * @param since - The last `paymentStatus` seen, or `null` for the first call.
 * @param signal - Aborts the request when the page leaves the payment.
 * @returns The status, or `null` for a failed request or an unreadable answer.
 */
export async function waitShopPayment(
  payment: string,
  since: ShopPaymentStatus | null,
  signal?: AbortSignal,
): Promise<ShopPaymentWait | null> {
  const query = since === null ? '' : `?since=${since}`;
  try {
    const response = await fetch(`/lnurlp/wait/${encodeURIComponent(payment)}${query}`, {
      cache: 'no-store',
      ...(signal === undefined ? {} : { signal }),
    });
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
