import {
  accountSchema,
  sessionResultSchema,
  startChallengeSchema,
  type Account,
  type SessionResult,
  type StartChallenge,
} from '@/lib/api-types';
import { getApiUrl } from '@/lib/config';

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
