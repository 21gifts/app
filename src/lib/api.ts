import { z } from 'zod';
import {
  accountSchema,
  sessionResultSchema,
  startChallengeSchema,
  type Account,
  type SessionResult,
  type StartChallenge,
} from '@/lib/api-types';
import { getApiUrl } from '@/lib/config';

/** Runtime shape of the api's error envelope, carrying a human-readable message. */
const apiErrorSchema = z.object({ error: z.string() });

/**
 * Starts a new LNURL-auth challenge.
 *
 * @returns The challenge to render as a QR and poll against.
 * @throws Error when the api responds with a non-2xx status, or when the body
 * does not match {@link startChallengeSchema} — either way the flow cannot
 * proceed, so we fail loudly rather than guess.
 */
export async function startLnurlAuth(): Promise<StartChallenge> {
  const response = await fetch(`${getApiUrl()}/auth/lnurl`);
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
  const response = await fetch(`${getApiUrl()}/auth/session`, {
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
  const response = await fetch(`${getApiUrl()}/me`, {
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
  const response = await fetch(`${getApiUrl()}/me/lightning-address`, {
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
  const response = await fetch(`${getApiUrl()}/me/lightning-address`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to unlink Lightning Address: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}
