import { z } from 'zod';
import {
  accountSchema,
  sessionResultSchema,
  startChallengeSchema,
  lnAddressResolvedSchema,
  type Account,
  type LnAddressResolved,
  type SessionResult,
  type StartChallenge,
} from '@/lib/api-types';

/** Runtime shape of the api's error envelope, carrying a human-readable message. */
const apiErrorSchema = z.object({ error: z.string() });

/** Statuses whose bodies carry a human-readable `{ error }` from the api. */
const API_MESSAGE_STATUSES = new Set([400, 502]);

/**
 * Rewrites api error text so the visitor never sees Lightning / LNURL jargon.
 *
 * @param raw - The api's `error` string.
 * @returns Copy that speaks only of Bitcoin and Wallet of Satoshi.
 */
function toUserFacingError(raw: string): string {
  if (/^Invalid Lightning Address$/i.test(raw)) {
    return 'That Wallet of Satoshi address is not valid';
  }
  if (/^Not a valid Lightning Address/i.test(raw)) {
    return 'Enter an address like you@walletofsatoshi.com';
  }
  if (/Lightning Address could not be resolved/i.test(raw)) {
    return 'That Wallet of Satoshi address could not be found';
  }
  if (/upstream api unreachable/i.test(raw)) {
    return 'Something went wrong. Please try again.';
  }
  return raw
    .replace(/Lightning Address/gi, 'Wallet of Satoshi address')
    .replace(/LNURL-auth/gi, 'login')
    .replace(/LNURL auth/gi, 'login')
    .replace(/\bLNURL\b/gi, 'login')
    .replace(/\binvoice\b/gi, 'payment')
    .replace(/\bLightning\b/gi, 'Bitcoin');
}

/**
 * Reads `{ error }` from an api error body, or `null` when the body is not that
 * envelope (HTML, invalid JSON, missing `error`).
 *
 * @param response - The raw fetch response.
 * @returns The api's `error` string, or `null`.
 */
async function readApiError(response: Response): Promise<string | null> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : null;
  } catch {
    return null;
  }
}

/**
 * Throws rewritten api error text when the response is a known client or
 * upstream failure, so the form can surface the reason without jargon.
 * Malformed bodies are left for the caller fallback.
 *
 * @param response - The raw fetch response.
 * @throws Error with user-facing copy when the status is 400 or 502 and the
 * body carries a usable `error` string.
 */
async function throwIfApiMessage(response: Response): Promise<void> {
  if (!API_MESSAGE_STATUSES.has(response.status)) {
    return;
  }
  const raw = await readApiError(response);
  if (raw === null) {
    return;
  }
  throw new Error(toUserFacingError(raw));
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
 * Sets or replaces the account display name.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param name - The display name as typed.
 * @returns The updated {@link Account}.
 * @throws Error when the api rejects the name (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link accountSchema} validation.
 */
export async function setName(sessionToken: string, name: string): Promise<Account> {
  const response = await fetch('/me/name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not save your name' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not save your name');
  }
  return accountSchema.parse(await response.json());
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
 * @throws Error when the api rejects the address (400) — rewritten to
 * visitor-facing copy — on any other non-2xx status, or when the body fails
 * {@link accountSchema} validation.
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
    const raw = await readApiError(response);
    throw new Error(
      raw === null ? 'Could not save your Wallet of Satoshi address' : toUserFacingError(raw),
    );
  }
  if (!response.ok) {
    throw new Error('Could not save your Wallet of Satoshi address');
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
    throw new Error('Could not remove your Wallet of Satoshi address');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Resolves a Lightning Address to LNURL-pay metadata via the api cache.
 *
 * @param address - The `name@domain` address to look up.
 * @returns The {@link LnAddressResolved} payload (callback and amount bounds).
 * @throws Error when the api rejects the address (400, 502) — rewritten to
 * visitor-facing copy — on any other non-2xx status, or when the body fails
 * {@link lnAddressResolvedSchema} validation.
 */
export async function resolveLightningAddress(address: string): Promise<LnAddressResolved> {
  const response = await fetch(`/lightning-address?address=${encodeURIComponent(address)}`);
  await throwIfApiMessage(response);
  if (!response.ok) {
    throw new Error('Could not find that Wallet of Satoshi address');
  }
  return lnAddressResolvedSchema.parse(await response.json());
}
