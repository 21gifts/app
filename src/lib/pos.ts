import { z } from 'zod';
import { throwIfWalletAnswer } from '@/lib/api';

/**
 * One point-of-sale charge. `paid` once the api saw the payment; `paidAt` is
 * then its ISO time, otherwise `null` (also when the api does not send it).
 */
const posChargeSchema = z.object({
  id: z.string(),
  amountSats: z.number().int(),
  status: z.enum(['pending', 'paid', 'cancelled', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string(),
  paidAt: z.string().nullable().default(null),
});

/**
 * `GET /pos/charge` body. `charge` is the pending charge, or one paid within
 * the last minute.
 */
const posStateSchema = z.object({
  charge: posChargeSchema.nullable(),
  history: z.array(posChargeSchema),
});

/** A charge the till is showing. */
export type PosCharge = z.infer<typeof posChargeSchema>;

/** Open charge plus recent rows. */
export type PosState = z.infer<typeof posStateSchema>;

/**
 * Load the signed-in till.
 *
 * @param sessionToken - Bearer session.
 * @returns The open charge and history.
 * @throws Error when the response is not OK or not the expected JSON.
 */
export async function fetchPosState(sessionToken: string): Promise<PosState> {
  const response = await fetch('/pos/charge', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to load point of sale: ${response.status}`);
  }
  return posStateSchema.parse(await response.json());
}

/**
 * Open a charge for an exact sat amount.
 *
 * @param sessionToken - Bearer session.
 * @param amountSats - Whole sats.
 * @returns The created charge.
 * @throws {@link WalletRequiredError} or {@link CannotReceiveError} when a 400
 * carries `code` `wallet_required` or `cannot_receive` (the member's wallet is
 * not set up, or cannot receive); otherwise Error with the API `error` string,
 * or a status fallback.
 */
export async function createPosCharge(
  sessionToken: string,
  amountSats: number,
): Promise<PosCharge> {
  const response = await fetch('/pos/charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amountSats }),
  });
  await throwIfWalletAnswer(response);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body !== null && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Failed to create payment: ${response.status}`;
    throw new Error(message);
  }
  const parsed = z.object({ charge: posChargeSchema }).parse(body);
  return parsed.charge;
}

/**
 * Cancel the open charge.
 *
 * @param sessionToken - Bearer session.
 * @throws Error when no charge is open or the request fails.
 */
export async function cancelPosCharge(sessionToken: string): Promise<void> {
  const response = await fetch('/pos/charge', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to cancel payment: ${response.status}`);
  }
}

/** Open charge of a shop, as `GET /pay/:username` shows it. */
const payChargeSchema = z.object({
  amountSats: z.number().int().positive(),
  status: z.string().optional(),
  expiresAt: z.string(),
});

/** Invoice body of `POST /pay/:username/invoice`. */
const payInvoiceSchema = z.object({
  amountSats: z.number().int().optional(),
  sparkInvoice: z.string().min(1).nullable().optional(),
});

/** A shop's open charge and the Spark invoice that pays it without a fee. */
export interface ShopChargeInvoice {
  /** Whole sats of the charge. */
  amountSats: number;
  /** Spark invoice the api issued for that charge. */
  sparkInvoice: string;
}

/**
 * Spark invoice for the open charge of a 21.gifts shop, so the in-app wallet
 * pays that charge without a fee. Reads `GET /pay/:username`; when its
 * `charge` is pending and not expired, asks `POST /pay/:username/invoice` for
 * exactly that amount. Never rejects.
 *
 * @param username - Shop's 21.gifts username.
 * @returns The amount and Spark invoice, or `null` when there is no open
 *   charge, the api issued no Spark invoice, or a request failed.
 */
export async function fetchShopChargeInvoice(username: string): Promise<ShopChargeInvoice | null> {
  const path = `/pay/${encodeURIComponent(username)}`;
  try {
    const profile = await fetch(path);
    if (!profile.ok) {
      return null;
    }
    const body = z
      .object({ charge: payChargeSchema.nullable().optional() })
      .parse(await profile.json());
    const charge = body.charge ?? null;
    if (
      charge === null ||
      (charge.status !== undefined && charge.status !== 'pending') ||
      !(Date.parse(charge.expiresAt) > Date.now())
    ) {
      return null;
    }
    const sparkInvoice = await fetchMemberSparkInvoice(username, charge.amountSats, '');
    return sparkInvoice === null ? null : { amountSats: charge.amountSats, sparkInvoice };
  } catch {
    return null;
  }
}

/**
 * Spark invoice for exactly `amountSats` to a 21.gifts member, so the in-app
 * wallet pays that member without a fee. Asks `POST /pay/:username/invoice`
 * with `{ amountSats }` and, when `comment` is not empty, `comment`. Never
 * rejects.
 *
 * @param username - Member's 21.gifts username.
 * @param amountSats - Whole sats to pay.
 * @param comment - Message for the member, already trimmed and capped, or `''`.
 * @returns The Spark invoice, or `null` when the answer has none (or names
 *   another amount), the request fails, or the body is not the expected JSON.
 */
export async function fetchMemberSparkInvoice(
  username: string,
  amountSats: number,
  comment: string,
): Promise<string | null> {
  try {
    const response = await fetch(`/pay/${encodeURIComponent(username)}/invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(comment === '' ? { amountSats } : { amountSats, comment }),
    });
    if (!response.ok) {
      return null;
    }
    const invoice = payInvoiceSchema.parse(await response.json());
    if (
      invoice.sparkInvoice === null ||
      invoice.sparkInvoice === undefined ||
      (invoice.amountSats !== undefined && invoice.amountSats !== amountSats)
    ) {
      return null;
    }
    return invoice.sparkInvoice;
  } catch {
    return null;
  }
}
