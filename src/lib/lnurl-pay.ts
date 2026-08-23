import { z } from 'zod';

/** Minimal fetch used by the donate invoice request (tests inject a stub). */
export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const invoiceSchema = z.object({
  pr: z.string().min(1),
});

const INVOICE_UNREACHABLE = 'Could not start the Bitcoin payment';

/**
 * Convert a satoshi amount the user typed into millisatoshis.
 *
 * @param sats - Whole sats entered in the donate form.
 * @returns The amount in millisatoshis.
 * @throws Error when `sats` is not a positive finite integer.
 */
export function satsToMsat(sats: number): number {
  if (!Number.isInteger(sats) || !Number.isFinite(sats) || sats <= 0) {
    throw new Error('Amount must be a positive whole number of sats');
  }
  return sats * 1000;
}

/**
 * Human-readable sat label from millisatoshis.
 *
 * @param msat - Amount in millisatoshis.
 * @returns `"1 sat"`, `"N sats"`, or a decimal when the value is not a whole sat.
 */
export function formatMsatAsSats(msat: number): string {
  const sats = msat / 1000;
  if (sats === 1) {
    return '1 sat';
  }
  return `${sats} sats`;
}

/**
 * Fetch a BOLT11 invoice from an LNURL-pay callback in the browser.
 *
 * The api is not on this path: the callback comes from
 * {@link resolveLightningAddress} and the browser talks to the provider.
 *
 * @param args - HTTPS callback, amount in millisatoshis, optional fetch.
 * @returns The bolt11 `pr`.
 * @throws Error when the callback is not https, the amount is invalid, or the
 * provider cannot produce an invoice (collapsed to one message).
 */
export async function requestDonateInvoice(args: {
  callback: string;
  amountMsat: number;
  fetchImpl?: FetchFn;
}): Promise<string> {
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(args.callback);
  } catch {
    throw new Error(INVOICE_UNREACHABLE);
  }
  if (callbackUrl.protocol !== 'https:') {
    throw new Error(INVOICE_UNREACHABLE);
  }
  if (
    !Number.isInteger(args.amountMsat) ||
    !Number.isFinite(args.amountMsat) ||
    args.amountMsat <= 0
  ) {
    throw new Error('Enter a whole number of sats greater than zero');
  }

  callbackUrl.searchParams.set('amount', String(args.amountMsat));
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl(callbackUrl.toString(), { redirect: 'error' });
  } catch {
    throw new Error(INVOICE_UNREACHABLE);
  }
  if (!response.ok) {
    throw new Error(INVOICE_UNREACHABLE);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(INVOICE_UNREACHABLE);
  }
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(INVOICE_UNREACHABLE);
  }
  return parsed.data.pr;
}
