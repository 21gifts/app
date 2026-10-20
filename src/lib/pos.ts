import { z } from 'zod';
import { throwIfWalletAnswer } from '@/lib/api';
import type { FiatCode, StoredFiat } from '@/lib/committed-fiat';
import { logInteraction } from '@/lib/interaction-log';

const fiatCodeSchema = z.enum(['USD', 'CHF', 'EUR', 'PHP']);

/** The six stored fiat fields. Each call builds fresh schemas. */
function storedFiatFields(): {
  amountCurrency: z.ZodDefault<z.ZodNullable<typeof fiatCodeSchema>>;
  amount: z.ZodDefault<z.ZodNullable<z.ZodString>>;
  amountUsd: z.ZodDefault<z.ZodNullable<z.ZodString>>;
  amountChf: z.ZodDefault<z.ZodNullable<z.ZodString>>;
  amountEur: z.ZodDefault<z.ZodNullable<z.ZodString>>;
  amountPhp: z.ZodDefault<z.ZodNullable<z.ZodString>>;
} {
  return {
    amountCurrency: fiatCodeSchema.nullable().default(null),
    amount: z.string().nullable().default(null),
    amountUsd: z.string().nullable().default(null),
    amountChf: z.string().nullable().default(null),
    amountEur: z.string().nullable().default(null),
    amountPhp: z.string().nullable().default(null),
  };
}

/**
 * One point-of-sale charge. `paid` once the api saw the payment; `paidAt` is
 * then its ISO time, otherwise `null` (also when the api does not send it).
 * The fiat fields are the figure stored with the charge, or `null`.
 */
const posChargeSchema = z.object({
  id: z.string(),
  amountSats: z.number().int(),
  status: z.enum(['pending', 'paid', 'cancelled', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string(),
  paidAt: z.string().nullable().default(null),
  ...storedFiatFields(),
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
 * Open a charge for an exact sat amount, and record `pos_charge_created`.
 * Bitcoin sends `{ amountSats }` only. Fiat also sends the typed code and the
 * normalized draft.
 *
 * @param sessionToken - Bearer session.
 * @param amountSats - Whole sats.
 * @param typed - Fiat the operator typed, when the unit was fiat.
 * @returns The created charge.
 * @throws {@link WalletRequiredError} or {@link CannotReceiveError} when a 400
 * carries `code` `wallet_required` or `cannot_receive` (the member's wallet is
 * not set up, or cannot receive); otherwise Error with the API `error` string,
 * or a status fallback.
 */
export async function createPosCharge(
  sessionToken: string,
  amountSats: number,
  typed?: { amountCurrency: FiatCode; amount: string },
): Promise<PosCharge> {
  const payload =
    typed === undefined
      ? { amountSats }
      : { amountSats, amountCurrency: typed.amountCurrency, amount: typed.amount };
  const response = await fetch('/pos/charge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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
  logInteraction(
    'pos_charge_created',
    { chargeId: parsed.charge.id, amountSats: parsed.charge.amountSats },
    sessionToken,
  );
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
  id: z.string().optional(),
  amountSats: z.number().int().positive(),
  status: z.string().optional(),
  expiresAt: z.string(),
  ...storedFiatFields(),
});

/** Invoice body of `POST /pay/:username/invoice`. */
const payInvoiceSchema = z.object({
  amountSats: z.number().int().optional(),
  sparkInvoice: z.string().min(1).nullable().optional(),
});

/**
 * What the in-app wallet does for a 21.gifts shop on this host.
 *
 * - `invoice`: pay the open charge with its Spark invoice, without a fee.
 * - `none`: the shop has no open charge; it is paid like any member.
 * - `fallback`: a charge may be open but cannot be paid with a Spark invoice;
 *   the wallet reads the address as before.
 */
export type ShopChargeInvoice =
  | ({ kind: 'invoice'; amountSats: number; sparkInvoice: string } & StoredFiat)
  | { kind: 'none' }
  | { kind: 'fallback' };

/**
 * The pending charge `GET /pay/:username` shows, if it has not run out.
 *
 * @param path - `/pay/:username`, already encoded.
 * @returns The charge, or `null` when there is none.
 * @throws Error when the answer is not OK or not the expected JSON.
 */
async function readOpenCharge(path: string): Promise<z.infer<typeof payChargeSchema> | null> {
  const profile = await fetch(path);
  if (!profile.ok) {
    throw new Error(`Failed to load pay link: ${profile.status}`);
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
  return charge;
}

/**
 * Spark invoice for the open charge of a 21.gifts shop, so the in-app wallet
 * pays that charge without a fee. Reads `GET /pay/:username`; when its
 * `charge` is pending and not expired, asks `POST /pay/:username/invoice` for
 * exactly that amount, then reads `GET /pay/:username` again: the invoice
 * counts only while that same charge is still open, since the api also issues
 * a Spark invoice to a member without a charge. Never rejects.
 *
 * @param username - Shop's 21.gifts username.
 * @returns `invoice` with the amount and Spark invoice; `none` when no charge
 *   is open (also when it closed before the second read); `fallback` when a
 *   read fails, the api issued no Spark invoice, or another charge is open on
 *   the second read.
 */
export async function fetchShopChargeInvoice(username: string): Promise<ShopChargeInvoice> {
  const path = `/pay/${encodeURIComponent(username)}`;
  try {
    const charge = await readOpenCharge(path);
    if (charge === null) {
      return { kind: 'none' };
    }
    const sparkInvoice = await fetchMemberSparkInvoice(username, charge.amountSats, '');
    if (sparkInvoice === null) {
      return { kind: 'fallback' };
    }
    const again = await readOpenCharge(path);
    if (again === null) {
      return { kind: 'none' };
    }
    if (
      again.id !== charge.id ||
      again.amountSats !== charge.amountSats ||
      again.expiresAt !== charge.expiresAt
    ) {
      return { kind: 'fallback' };
    }
    return {
      kind: 'invoice',
      amountSats: charge.amountSats,
      sparkInvoice,
      amountCurrency: charge.amountCurrency,
      amount: charge.amount,
      amountUsd: charge.amountUsd,
      amountChf: charge.amountChf,
      amountEur: charge.amountEur,
      amountPhp: charge.amountPhp,
    };
  } catch {
    return { kind: 'fallback' };
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

/** Receipt of one shop charge, as `GET /pay/.../charges/:id` returns it. */
const shopReceiptSchema = z.object({
  id: z.string(),
  amountSats: z.number().int(),
  status: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  paidAt: z.string().nullable(),
  amountCurrency: fiatCodeSchema.nullable(),
  amount: z.string().nullable(),
  amountUsd: z.string().nullable(),
  amountChf: z.string().nullable(),
  amountEur: z.string().nullable(),
  amountPhp: z.string().nullable(),
});

/** A shop charge receipt the payment screen can show. */
export type ShopChargeReceipt = z.infer<typeof shopReceiptSchema>;

/**
 * Load the receipt of a shop charge. A Lightning address with a local part
 * uses `GET /pay/:username/charges/:id`; otherwise `GET /pay/charges/:id`.
 * A 404, any other failed read, or a body that is not a receipt is missing.
 *
 * @param chargeId - Id from the shop memo, the text after `pos:`.
 * @param username - Local part of the paid Lightning address, or `null`.
 * @returns The receipt, or `null` when it is missing.
 */
export async function fetchShopChargeReceipt(
  chargeId: string,
  username: string | null,
): Promise<ShopChargeReceipt | null> {
  const id = encodeURIComponent(chargeId);
  const path =
    username === null ? `/pay/charges/${id}` : `/pay/${encodeURIComponent(username)}/charges/${id}`;
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return null;
    }
    return shopReceiptSchema.parse(await response.json());
  } catch {
    return null;
  }
}
