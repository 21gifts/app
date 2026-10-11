import { decodeLnurl } from '@/lib/lnurl';
import { payLinkUsername } from '@/lib/pay-link';

/** One stablecoin figure from a pay request. Lightning is not included. */
export interface StablecoinAmount {
  method: string;
  asset: 'USDT' | 'USDC';
  amount: string;
}

/** Stablecoin amounts and the quote expiry a pay request is offering. */
export interface PayRequestOffer {
  amounts: StablecoinAmount[];
  /** `quote.expiration` as returned, or `null` when the response has none. */
  expiresAt: string | null;
}

/** Result of asking the api to open the shop payment for one sat amount. */
export type ShopPaymentOpen = 'opened' | 'conflict' | 'unavailable';

/**
 * The pay-link URL this page may fetch for the sticker LNURL.
 *
 * Same acceptance as {@link payLinkUsername}. The page does not add a query.
 *
 * @param lightning - Encoded LNURL from the payment-page query.
 * @param pageHost - Current page host, optionally including a port.
 * @returns The decoded URL, or `null` when the payment link is invalid.
 */
export function payRequestUrl(lightning: string, pageHost: string): string | null {
  if (payLinkUsername(lightning, pageHost) === null) {
    return null;
  }
  return decodeLnurl(lightning);
}

/**
 * USDT and USDC amounts a pay request is offering right now.
 *
 * A method that is absent, empty, Lightning, or not available is skipped.
 * The amount string is the one in the response. It is not recomputed.
 *
 * @param body - JSON from the decoded pay link.
 * @returns One entry per offered chain and asset, in response order.
 */
export function stablecoinAmounts(body: unknown): StablecoinAmount[] {
  if (body === null || typeof body !== 'object') {
    return [];
  }
  const rows = (body as { transferAmounts?: unknown }).transferAmounts;
  if (!Array.isArray(rows)) {
    return [];
  }
  const amounts: StablecoinAmount[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row === null || typeof row !== 'object') {
      continue;
    }
    const method = (row as { method?: unknown }).method;
    const available = (row as { available?: unknown }).available;
    const assets = (row as { assets?: unknown }).assets;
    if (typeof method !== 'string' || method === '' || method === 'Lightning') {
      continue;
    }
    if (available !== true || !Array.isArray(assets)) {
      continue;
    }
    for (const assetRow of assets) {
      if (assetRow === null || typeof assetRow !== 'object') {
        continue;
      }
      const asset = (assetRow as { asset?: unknown }).asset;
      const amount = (assetRow as { amount?: unknown }).amount;
      if ((asset !== 'USDT' && asset !== 'USDC') || typeof amount !== 'string' || amount === '') {
        continue;
      }
      const key = `${method}\0${asset}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      amounts.push({ method, asset, amount });
    }
  }
  return amounts;
}

/**
 * Quote expiry carried by a pay request.
 *
 * The string is kept as returned. A missing or unparseable value is no expiry.
 *
 * @param body - JSON from the decoded pay link.
 * @returns `quote.expiration`, or `null`.
 */
function quoteExpiration(body: unknown): string | null {
  if (body === null || typeof body !== 'object') {
    return null;
  }
  const quote = (body as { quote?: unknown }).quote;
  if (quote === null || typeof quote !== 'object') {
    return null;
  }
  const expiration = (quote as { expiration?: unknown }).expiration;
  if (
    typeof expiration !== 'string' ||
    expiration === '' ||
    !Number.isFinite(Date.parse(expiration))
  ) {
    return null;
  }
  return expiration;
}

/**
 * Stablecoin amounts and quote expiry from one pay-request body.
 *
 * @param body - JSON from the decoded pay link.
 * @returns Amounts in response order, one per chain and asset, and the expiry.
 */
export function readPayRequest(body: unknown): PayRequestOffer {
  return { amounts: stablecoinAmounts(body), expiresAt: quoteExpiration(body) };
}

/**
 * Open the shop payment for `amountSats`.
 *
 * `409` means another amount is already open. Any other failure, including a
 * route that is not mounted, leaves Lightning as it is.
 *
 * @param username - Shop username from the pay link.
 * @param amountSats - Whole sat amount the page already accepted.
 * @returns Whether a payment row was opened.
 */
export async function openShopPayment(
  username: string,
  amountSats: number,
): Promise<ShopPaymentOpen> {
  try {
    const response = await fetch(`/pay/${encodeURIComponent(username)}/payment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountSats }),
    });
    if (response.status === 409) {
      return 'conflict';
    }
    if (!response.ok) {
      return 'unavailable';
    }
    const body = (await response.json()) as { payment?: unknown };
    return typeof body.payment === 'string' && body.payment !== '' ? 'opened' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Read stablecoin amounts from the decoded pay link.
 *
 * The URL is fetched as given. This function does not add `timeout` or any
 * other query. A failure is no amounts, not an error on the page.
 *
 * @param url - Decoded pay-link URL.
 * @returns The offer, or no amounts when the request fails.
 */
export async function fetchPayRequest(url: string): Promise<PayRequestOffer> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { amounts: [], expiresAt: null };
    }
    return readPayRequest(await response.json());
  } catch {
    return { amounts: [], expiresAt: null };
  }
}
