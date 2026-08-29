import { z } from 'zod';
import {
  accountSchema,
  forumListSchema,
  forumMessageSchema,
  lnAddressResolvedSchema,
  giftDaySchema,
  giftStatsSchema,
  messageInvoiceSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  type Account,
  type ForumMessage,
  type GiftDay,
  type GiftStats,
  type LnAddressResolved,
  type MessageInvoice,
  type PasskeyBegin,
  type PasskeySession,
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

/**
 * Fetches outbound gifts for one UTC calendar day.
 *
 * @param day - UTC `YYYY-MM-DD`.
 * @returns The {@link GiftDay} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link giftDaySchema}.
 */
export async function fetchGiftDay(day: string): Promise<GiftDay> {
  try {
    const response = await fetch(`/gifts?day=${encodeURIComponent(day)}`);
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return giftDaySchema.parse(await response.json());
  } catch {
    throw new Error('Could not load gift stats. Please try again.');
  }
}

/**
 * Fetches aggregated outbound gift statistics.
 *
 * @returns The {@link GiftStats} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link giftStatsSchema}.
 */
export async function fetchGiftStats(): Promise<GiftStats> {
  try {
    const response = await fetch('/gifts/stats');
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return giftStatsSchema.parse(await response.json());
  } catch {
    throw new Error('Could not load gift stats. Please try again.');
  }
}

/**
 * Fetches every public forum message (newest first).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The message list.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link forumListSchema}.
 */
export async function fetchMessages(sessionToken: string): Promise<ForumMessage[]> {
  try {
    const response = await fetch('/messages', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return forumListSchema.parse(await response.json()).messages;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Posts a new public forum message.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param text - Message body as typed (api trims and validates length).
 * @returns The created {@link ForumMessage}.
 * @throws Error when the api rejects the text (400 or 429) — the api error
 * string when present, otherwise a fallback — on any other non-2xx status, or
 * when the body fails {@link forumMessageSchema} validation.
 */
export async function postMessage(sessionToken: string, text: string): Promise<ForumMessage> {
  const response = await fetch('/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not post your message' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not post your message');
  }
  return forumMessageSchema.parse(await response.json());
}

/**
 * Requests a BOLT11 invoice to pay a public forum message.
 *
 * Does not increment the message `sats` total — that updates only after the
 * payment is confirmed on the api.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param messageId - Forum message UUID from the public JSON.
 * @param sats - Whole satoshis to pay (≥ 1).
 * @returns `{ pr, amountSats }` for QR / Wallet of Satoshi.
 * @throws Error with collapsed visitor copy on 400/404/429/503 (and other
 * non-2xx), or when the body fails {@link messageInvoiceSchema}.
 */
export async function postMessageInvoice(
  sessionToken: string,
  messageId: string,
  sats: number,
): Promise<MessageInvoice> {
  const response = await fetch(`/messages/${encodeURIComponent(messageId)}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sats }),
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not start the Bitcoin payment' : toUserFacingError(raw));
  }
  if (response.status === 404) {
    throw new Error('Could not start the Bitcoin payment');
  }
  if (response.status === 503) {
    throw new Error('Could not start the Bitcoin payment');
  }
  if (!response.ok) {
    throw new Error('Could not start the Bitcoin payment');
  }
  return messageInvoiceSchema.parse(await response.json());
}

/**
 * Starts a passkey registration ceremony.
 *
 * @returns Challenge id plus WebAuthn creation options JSON.
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function startPasskeyRegistration(): Promise<PasskeyBegin> {
  const response = await fetch('/auth/passkey/register/begin', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to start passkey registration: ${response.status}`);
  }
  return passkeyBeginSchema.parse(await response.json());
}

/**
 * Completes passkey registration and issues a session.
 *
 * @param challengeId - Id returned by {@link startPasskeyRegistration}.
 * @param credential - Browser attestation JSON (`PublicKeyCredential.toJSON()`).
 * @returns Token plus account (`linkingKey` is null).
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function finishPasskeyRegistration(
  challengeId: string,
  credential: unknown,
): Promise<PasskeySession> {
  const response = await fetch('/auth/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, credential }),
  });
  if (!response.ok) {
    throw new Error(`Failed to finish passkey registration: ${response.status}`);
  }
  return passkeySessionSchema.parse(await response.json());
}

/**
 * Starts a passkey authentication ceremony.
 *
 * @returns Challenge id plus WebAuthn request options JSON.
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function startPasskeyAuthentication(): Promise<PasskeyBegin> {
  const response = await fetch('/auth/passkey/authenticate/begin', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to start passkey authentication: ${response.status}`);
  }
  return passkeyBeginSchema.parse(await response.json());
}

/**
 * Completes passkey authentication and issues a session.
 *
 * @param challengeId - Id returned by {@link startPasskeyAuthentication}.
 * @param credential - Browser assertion JSON.
 * @returns Token plus account.
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function finishPasskeyAuthentication(
  challengeId: string,
  credential: unknown,
): Promise<PasskeySession> {
  const response = await fetch('/auth/passkey/authenticate/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, credential }),
  });
  if (!response.ok) {
    throw new Error(`Failed to finish passkey authentication: ${response.status}`);
  }
  return passkeySessionSchema.parse(await response.json());
}
