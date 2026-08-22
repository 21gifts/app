import { z } from 'zod';
import {
  accountSchema,
  sessionResultSchema,
  startChallengeSchema,
  lnAddressResolvedSchema,
  verificationSentSchema,
  type Account,
  type LnAddressResolved,
  type SessionResult,
  type StartChallenge,
  type VerificationSent,
} from '@/lib/api-types';

/** Runtime shape of the api's error envelope, carrying a human-readable message. */
const apiErrorSchema = z.object({ error: z.string() });

/** Statuses whose bodies carry a human-readable `{ error }` from the api. */
const API_MESSAGE_STATUSES = new Set([400, 409, 502, 503]);

/**
 * Throws the api's own error text when the response is a known client or
 * upstream failure, so the form can surface the reason as-is.
 *
 * @param response - The raw fetch response.
 * @throws Error with the api's `error` string when the status is 400, 409,
 * 502, or 503.
 */
async function throwIfApiMessage(response: Response): Promise<void> {
  if (API_MESSAGE_STATUSES.has(response.status)) {
    throw new Error(apiErrorSchema.parse(await response.json()).error);
  }
}

/**
 * Starts a new LNURL-auth challenge.
 *
 * @returns The challenge to render as a QR and poll against.
 * @throws Error when the api responds with a non-2xx status, or when the body
 * does not match {@link startChallengeSchema} — either way the flow cannot
 * proceed, so we fail loudly rather than guess.
 */
export async function startLnurlAuth(): Promise<StartChallenge> {
  const response = await fetch('/auth/lnurl');
  if (!response.ok) {
    throw new Error(`Failed to start LNURL auth: ${response.status}`);
  }
  return startChallengeSchema.parse(await response.json());
}

/**
 * Polls the status of an in-flight LNURL-auth challenge.
 *
 * @param pollToken - The secret returned by {@link startLnurlAuth}; sent in the
 * `X-Poll-Token` header (never the public `k1`).
 * @returns The current {@link SessionResult}.
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function pollSession(pollToken: string): Promise<SessionResult> {
  const response = await fetch('/auth/session', {
    headers: { 'X-Poll-Token': pollToken },
  });
  if (!response.ok) {
    throw new Error(`Failed to poll session: ${response.status}`);
  }
  return sessionResultSchema.parse(await response.json());
}

/**
 * Fetches the account behind a session token.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The {@link Account}, or `null` when the token is rejected (401) —
 * the caller treats that as "not logged in" and clears local state.
 * @throws Error on any other non-2xx status or a body that fails validation.
 */
export async function fetchMe(sessionToken: string): Promise<Account | null> {
  const response = await fetch('/me', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}

/**
 * Links or replaces the account's receiving Lightning Address.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param address - The `name@domain.tld` Lightning Address to store.
 * @returns The updated {@link Account}.
 * @throws Error when the api rejects the address (400) — the thrown message is
 * the api's own error text, so the form can show why it was rejected — on any
 * other non-2xx status, or when the body fails {@link accountSchema} validation.
 */
export async function setLightningAddress(sessionToken: string, address: string): Promise<Account> {
  const response = await fetch('/me/lightning-address', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  });
  if (response.status === 400) {
    throw new Error(apiErrorSchema.parse(await response.json()).error);
  }
  if (!response.ok) {
    throw new Error(`Failed to set Lightning Address: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}

/**
 * Unlinks the account's Lightning Address, clearing it.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The updated {@link Account}, with `lightningAddress` set to `null`.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function unlinkLightningAddress(sessionToken: string): Promise<Account> {
  const response = await fetch('/me/lightning-address', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to unlink Lightning Address: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}

/**
 * Starts Lightning Address verification by sending a micro-payment whose
 * comment carries a nonce the user must confirm.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The {@link VerificationSent} payload (`sats`, expiry). The nonce
 * is never included — the user reads it from their wallet.
 * @throws Error when the api rejects the request (400, 409, 502, 503) — the
 * thrown message is the api's own error text — on any other non-2xx status,
 * or when the body fails {@link verificationSentSchema} validation.
 */
export async function startLightningAddressVerification(
  sessionToken: string,
): Promise<VerificationSent> {
  const response = await fetch('/me/lightning-address/verification', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  await throwIfApiMessage(response);
  if (!response.ok) {
    throw new Error(`Failed to start Lightning Address verification: ${response.status}`);
  }
  return verificationSentSchema.parse(await response.json());
}

/**
 * Confirms Lightning Address verification with the nonce from the
 * micro-payment comment.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param nonce - The code the user read from the wallet payment comment.
 * @returns The updated {@link Account}, with `lightningAddressVerified` true.
 * @throws Error when the api rejects the nonce or the challenge (400, 409,
 * 502, 503) — the thrown message is the api's own error text — on any other
 * non-2xx status, or when the body fails {@link accountSchema} validation.
 */
export async function confirmLightningAddressVerification(
  sessionToken: string,
  nonce: string,
): Promise<Account> {
  const response = await fetch('/me/lightning-address/verification/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nonce }),
  });
  await throwIfApiMessage(response);
  if (!response.ok) {
    throw new Error(`Failed to confirm Lightning Address verification: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}

/**
 * Resolves a Lightning Address to LNURL-pay metadata via the api cache.
 *
 * @param address - The `name@domain` address to look up.
 * @returns The {@link LnAddressResolved} payload (callback and amount bounds).
 * @throws Error when the api rejects the address (400, 502) — the thrown
 * message is the api's own error text — on any other non-2xx status, or when
 * the body fails {@link lnAddressResolvedSchema} validation.
 */
export async function resolveLightningAddress(address: string): Promise<LnAddressResolved> {
  const response = await fetch(`/lightning-address?address=${encodeURIComponent(address)}`);
  await throwIfApiMessage(response);
  if (!response.ok) {
    throw new Error(`Failed to resolve Lightning Address: ${response.status}`);
  }
  return lnAddressResolvedSchema.parse(await response.json());
}
