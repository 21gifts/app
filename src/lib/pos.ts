import { z } from 'zod';
import { throwIfWalletAnswer } from '@/lib/api';

/** One point-of-sale charge. There is no paid status. */
const posChargeSchema = z.object({
  id: z.string(),
  amountSats: z.number().int(),
  status: z.enum(['pending', 'cancelled', 'expired']),
  createdAt: z.string(),
  expiresAt: z.string(),
});

/** `GET /pos/charge` body. */
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
