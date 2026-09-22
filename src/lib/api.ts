import { z } from 'zod';
import {
  accountSchema,
  contactSchema,
  conversationInvoiceSchema,
  conversationListSchema,
  conversationMessageSchema,
  conversationResponseSchema,
  conversationSchema,
  conversationThreadSchema,
  notificationListSchema,
  notificationSchema,
  forumListSchema,
  forumMessageSchema,
  hiddenListSchema,
  lnAddressResolvedSchema,
  giftDaySchema,
  giftStatsSchema,
  accountActivitySchema,
  memberProfileSchema,
  messageInvoiceSchema,
  moderatorProposalsResponseSchema,
  fundingApplyResponseSchema,
  fundingApplicationDetailSchema,
  fundingApplicationsResponseSchema,
  fundingDecisionResultSchema,
  trustActionResultSchema,
  trustChainSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  pushSubscriptionResponseSchema,
  vapidPublicSchema,
  viewProfileSchema,
  type Account,
  type NotificationLevel,
  type ContactMessage,
  type Conversation,
  type ConversationInvoice,
  type ConversationMessage,
  type Notification,
  type NotificationList,
  type ForumMessage,
  type HiddenMessage,
  type GiftDay,
  type GiftStats,
  type AccountActivity,
  type LnAddressResolved,
  type MemberProfile,
  type MessageInvoice,
  type ModeratorProposal,
  type FundingApplication,
  type FundingApplicationDetail,
  type FundingDecisionResult,
  type OwnerFunding,
  type PasskeyBegin,
  type PasskeySession,
  type TrustActionResult,
  type TrustChain,
  type ViewProfile,
} from '@/lib/api-types';
import { MissingRequirementsError, parseMissingRequirements } from '@/lib/missing-requirements';

/**
 * Exact api 400 body when a Wallet of Satoshi address fails the NIP-57 zap probe.
 * Matched literally (English) before visitor-facing rewrite.
 */
export const LIGHTNING_ADDRESS_NOT_ZAP_ERROR =
  'This Wallet of Satoshi address cannot receive these Bitcoin payments';

/**
 * Exact api 403 body when the visitor signed in with a refused account.
 * Matched literally (English).
 */
export const WRONG_ACCOUNT_ERROR =
  'You signed in with the wrong account. Please try again with the correct account.';

/**
 * Api 403 rejection when the session belongs to an account with sessionRefused.
 */
export class WrongAccountError extends Error {
  /**
   * @returns A wrong-account error with the api's exact English copy.
   */
  public constructor() {
    super(WRONG_ACCOUNT_ERROR);
    this.name = 'WrongAccountError';
  }
}

/**
 * True for {@link WrongAccountError} or any `Error` whose message is exactly
 * {@link WRONG_ACCOUNT_ERROR}.
 *
 * @param error - Unknown rejection.
 * @returns Whether the visitor signed in with the wrong account.
 */
export function isWrongAccountError(error: unknown): boolean {
  return (
    error instanceof WrongAccountError ||
    (error instanceof Error && error.message === WRONG_ACCOUNT_ERROR)
  );
}

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
 * Throws {@link WrongAccountError} when a 403 body is the duplicate-account
 * api string. Other 403 bodies are left for the caller fallback.
 *
 * @param response - The raw fetch response.
 * @throws WrongAccountError when the status is 403 and the body matches.
 */
async function throwIfWrongAccount(response: Response): Promise<void> {
  if (response.status !== 403) {
    return;
  }
  const raw = await readApiError(response);
  if (raw === WRONG_ACCOUNT_ERROR) {
    throw new WrongAccountError();
  }
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
 * Sets, replaces, or clears the account free-text location.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param location - The location as typed. An empty string is a valid request
 * and clears the stored value.
 * @returns The updated {@link Account}.
 * @throws Error when the api rejects the location (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link accountSchema} validation.
 */
export async function setLocation(sessionToken: string, location: string): Promise<Account> {
  const response = await fetch('/me/location', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ location }),
  });
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not save your location' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not save your location');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Sets or replaces the account About me note.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param text - The About me text as typed.
 * @param photo - JPEG payload to set, `null` to clear, omitted to keep the stored photo.
 * @returns The updated {@link Account}.
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error `'Could not save. Please try again.'` on any other non-2xx
 * status or a 409 body that is not `missing_requirements`.
 * @throws when the 2xx body fails {@link accountSchema} validation.
 */
export async function putAboutMe(
  sessionToken: string,
  text: string,
  photo?: { contentType: string; data: string } | null,
): Promise<Account> {
  const response = await fetch('/me/about', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      ...(photo === undefined ? {} : { photo }),
    }),
  });
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not save. Please try again.');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not save. Please try again.');
  }
  if (!response.ok) {
    throw new Error('Could not save. Please try again.');
  }
  return accountSchema.parse(await response.json());
}

const ABOUT_ME_PHOTO_LOAD_ERROR = 'Could not load. Please try again.';

/**
 * Fetches the signed-in account's About me photo bytes.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The photo as a Blob.
 * @throws Error `'Could not load. Please try again.'` on a non-ok response,
 * an empty blob, or a network failure.
 */
export async function fetchAboutMePhoto(sessionToken: string): Promise<Blob> {
  try {
    const response = await fetch('/me/about/photo', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
    }
    return blob;
  } catch {
    throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
  }
}

/**
 * Fetches a public view-key profile's About me photo bytes.
 *
 * @param viewKey - 64 lowercase hex capability key.
 * @returns The photo as a Blob.
 * @throws Error `'Could not load. Please try again.'` on a non-ok response,
 * an empty blob, or a network failure.
 */
export async function fetchViewAboutMePhoto(viewKey: string): Promise<Blob> {
  try {
    const response = await fetch(`/view-key/${encodeURIComponent(viewKey)}/about/photo`);
    if (!response.ok) {
      throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
    }
    return blob;
  } catch {
    throw new Error(ABOUT_ME_PHOTO_LOAD_ERROR);
  }
}

/**
 * Fetches the account behind a session token.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The {@link Account}, or `null` when the token is rejected (401) —
 * the caller treats that as "not logged in" and clears local state.
 * @throws {@link WrongAccountError} on 403 with the duplicate-account api string.
 * @throws Error on any other non-2xx status or a body that fails validation.
 */
export async function fetchMe(sessionToken: string): Promise<Account | null> {
  const response = await fetch('/me', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status === 401) {
    return null;
  }
  await throwIfWrongAccount(response);
  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${response.status}`);
  }
  return accountSchema.parse(await response.json());
}

/**
 * Fetches a public read-only profile by view key via the same-origin proxy.
 *
 * @param viewKey - 64 lowercase hex capability key.
 * @returns The {@link ViewProfile}, or `null` when the key is unknown (404).
 * @throws Error on any other non-2xx status or a body that fails validation.
 */
export async function fetchViewProfile(viewKey: string): Promise<ViewProfile | null> {
  const response = await fetch(`/view-key/${encodeURIComponent(viewKey)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch view profile: ${response.status}`);
  return viewProfileSchema.parse(await response.json());
}

/**
 * Skips one onboarding setup step without filling the field.
 *
 * @param sessionToken - Bearer session.
 * @param step - `name` or `lightning-address` (rules cannot be skipped).
 * @returns The updated {@link Account} with advanced `setup` and refreshed `missing`.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}.
 */
export async function skipSetup(
  sessionToken: string,
  step: 'name' | 'lightning-address',
): Promise<Account> {
  const response = await fetch('/me/setup/skip', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ step }),
  });
  if (!response.ok) {
    throw new Error('Could not skip this step');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Fetches a signed-in member profile by account id.
 *
 * @param sessionToken - Bearer session.
 * @param accountId - Member account id.
 * @returns The {@link MemberProfile}, or `null` on 401/404.
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error on other non-2xx or a body that fails {@link memberProfileSchema}.
 */
export async function fetchMember(
  sessionToken: string,
  accountId: string,
): Promise<MemberProfile | null> {
  const response = await fetch(`/forum/members/${encodeURIComponent(accountId)}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status === 401 || response.status === 404) {
    return null;
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not load this profile. Please try again.');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not load this profile. Please try again.');
  }
  if (!response.ok) {
    throw new Error('Could not load this profile. Please try again.');
  }
  return memberProfileSchema.parse(await response.json());
}

/**
 * Fetches a member's top-level forum posts or replies (newest first).
 *
 * @param sessionToken - Bearer session.
 * @param accountId - Member account id.
 * @param suffix - `posts` or `replies`.
 * @returns The message list.
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
async function fetchMemberForumList(
  sessionToken: string,
  accountId: string,
  suffix: 'posts' | 'replies',
): Promise<ForumMessage[]> {
  try {
    const response = await fetch(`/forum/members/${encodeURIComponent(accountId)}/${suffix}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (response.status === 409) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Could not load messages. Please try again.');
      }
      const missing = parseMissingRequirements(body);
      if (missing !== null) {
        throw missing;
      }
      throw new Error('Could not load messages. Please try again.');
    }
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return forumListSchema.parse(await response.json()).messages;
  } catch (err) {
    if (err instanceof MissingRequirementsError) {
      throw err;
    }
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches a member's top-level forum posts (newest first, api cap 200).
 *
 * @param sessionToken - Bearer session.
 * @param accountId - Member account id.
 * @returns The message list.
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchMemberPosts(
  sessionToken: string,
  accountId: string,
): Promise<ForumMessage[]> {
  return fetchMemberForumList(sessionToken, accountId, 'posts');
}

/**
 * Fetches a member's forum replies (newest first, api cap 200).
 *
 * @param sessionToken - Bearer session.
 * @param accountId - Member account id.
 * @returns The message list (reply rows may be payable; optional `parentId`).
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchMemberReplies(
  sessionToken: string,
  accountId: string,
): Promise<ForumMessage[]> {
  return fetchMemberForumList(sessionToken, accountId, 'replies');
}

/**
 * Sets the unique 21.gifts username (LUD-16 local-part).
 *
 * @param sessionToken - Bearer session.
 * @param username - Handle (`a-z0-9-_.`).
 * @returns The updated {@link Account}.
 * @throws Error with visitor-facing copy on 400/409 or other failures.
 */
export async function setUsername(sessionToken: string, username: string): Promise<Account> {
  const response = await fetch('/me/username', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });
  if (response.status === 409) {
    throw new Error('username-taken');
  }
  if (response.status === 400) {
    throw new Error('username-invalid');
  }
  if (!response.ok) {
    throw new Error('username-request');
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
    if (raw === LIGHTNING_ADDRESS_NOT_ZAP_ERROR) {
      throw new Error(LIGHTNING_ADDRESS_NOT_ZAP_ERROR);
    }
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
 * Permanently dismisses the welcome-forum living-room laws hint for the account.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The updated {@link Account}, with `forumLawsDismissed` set to `true`.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function dismissForumLaws(sessionToken: string): Promise<Account> {
  const response = await fetch('/me/forum-laws-dismissed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error('Could not dismiss the living-room hint');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Sets the signed-in account notification level.
 *
 * @param session - A bearer token from a completed challenge.
 * @param level - `all`, `active`, or `mentions`.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function postNotificationLevel(
  session: string,
  level: NotificationLevel,
): Promise<Account> {
  const response = await fetch('/me/notification-level', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ level }),
  });
  if (!response.ok) {
    throw new Error('Could not save notification level.');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Records agreement to the living-room rules on the signed-in account.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The updated {@link Account}, with `rulesAgreedAt` set.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function agreeToRules(sessionToken: string): Promise<Account> {
  const response = await fetch('/me/rules-agreement', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error('Could not save your agreement');
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
 * Fetches aggregated outbound gift statistics, optionally filtered by recipient.
 *
 * @param recipient - Optional recipient handle; appended as `?recipient=` when
 * non-empty after trim (caller may pass a handle already stripped of `@domain`).
 * @returns The {@link GiftStats} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link giftStatsSchema}.
 */
export async function fetchGiftStats(recipient?: string): Promise<GiftStats> {
  try {
    const trimmed = recipient?.trim() ?? '';
    const path =
      trimmed === '' ? '/gifts/stats' : `/gifts/stats?recipient=${encodeURIComponent(trimmed)}`;
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return giftStatsSchema.parse(await response.json());
  } catch {
    throw new Error('Could not load gift stats. Please try again.');
  }
}

const TRUST_CHAIN_LOAD_ERROR = 'Could not load the Trust Chain. Please try again.';
const TRUST_ACTION_ERROR = 'Could not update this member. Please try again.';

/**
 * Fetches the Trust Chain graph (who verified or appointed whom).
 *
 * @param sessionToken - Bearer session from a completed login.
 * @param around - Optional account id; loads one hop when set.
 * @returns The {@link TrustChain} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link trustChainSchema} (including 401/403).
 */
export async function fetchTrustChain(sessionToken: string, around?: string): Promise<TrustChain> {
  try {
    const path =
      around === undefined || around === ''
        ? '/trust/graph'
        : `/trust/graph?around=${encodeURIComponent(around)}`;
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(TRUST_CHAIN_LOAD_ERROR);
    }
    return trustChainSchema.parse(await response.json());
  } catch {
    throw new Error(TRUST_CHAIN_LOAD_ERROR);
  }
}

/**
 * Posts a staff Trust Chain action with the signed-in session.
 *
 * @param path - Same-origin proxy path.
 * @param sessionToken - Bearer session.
 * @param accountId - Subject account id.
 * @returns Parsed {@link TrustActionResult}.
 * @throws Error with visitor-facing copy on any failure.
 */
async function postTrustAction(
  path: string,
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    });
    if (!response.ok) {
      throw new Error(TRUST_ACTION_ERROR);
    }
    return trustActionResultSchema.parse(await response.json());
  } catch {
    throw new Error(TRUST_ACTION_ERROR);
  }
}

/**
 * Verifies that a basis member is a real person (in-person confirmation).
 *
 * @param sessionToken - Bearer session of a moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustVerify(
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/verify', sessionToken, accountId);
}

/**
 * Proposes a verified member as moderator.
 *
 * @param sessionToken - Bearer session of a moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustPropose(
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/propose-moderator', sessionToken, accountId);
}

/**
 * Confirms a pending moderator proposal (must be a different staff member).
 *
 * @param sessionToken - Bearer session of a moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustConfirm(
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/confirm-moderator', sessionToken, accountId);
}

/**
 * Appoints a basis or verified member as moderator (founder only).
 *
 * @param sessionToken - Bearer session of a founder.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustAppoint(
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/appoint-moderator', sessionToken, accountId);
}

const TRUST_PROPOSALS_LOAD_ERROR = 'Could not load moderator proposals. Please try again.';

/**
 * Fetches open moderator proposals for moderators.
 *
 * Hits same-origin `GET /trust/proposals` (Bearer). Next.js forbids a
 * `route.ts` beside `/moderate/proposals`, so the proxy lives at this path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The open-proposal list.
 * @throws Error with visitor-facing copy on 401/403/503, other non-2xx, a
 * network failure, or a body that fails {@link moderatorProposalsResponseSchema}.
 */
export async function fetchTrustProposals(sessionToken: string): Promise<ModeratorProposal[]> {
  try {
    const response = await fetch('/trust/proposals', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(TRUST_PROPOSALS_LOAD_ERROR);
    }
    return moderatorProposalsResponseSchema.parse(await response.json()).proposals;
  } catch {
    throw new Error(TRUST_PROPOSALS_LOAD_ERROR);
  }
}

const FUNDING_APPLY_ERROR = 'Could not submit your application. Please try again.';
const FUNDING_APPLICATIONS_LOAD_ERROR = 'Could not load grant applications. Please try again.';
const FUNDING_APPLICATION_LOAD_ERROR = 'Could not load this application. Please try again.';
const FUNDING_ACTION_ERROR = 'Could not update this member. Please try again.';

/**
 * Applies for the 21 gifts grant (verified and above).
 *
 * Hits same-origin `POST /funding/apply` (Bearer). Role `basis` is 403.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The updated {@link OwnerFunding} object.
 * @throws Error with visitor-facing copy on 401/403/409/503, other non-2xx, a
 * network failure, or a body that fails {@link fundingApplyResponseSchema}.
 */
export async function postFundingApply(sessionToken: string): Promise<OwnerFunding> {
  try {
    const response = await fetch('/funding/apply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error(FUNDING_APPLY_ERROR);
    }
    return fundingApplyResponseSchema.parse(await response.json()).funding;
  } catch {
    throw new Error(FUNDING_APPLY_ERROR);
  }
}

/**
 * Fetches open grant applications for moderators.
 *
 * Hits same-origin `GET /funding/applications` (Bearer). Next.js forbids a
 * `route.ts` beside `/moderate/applications`, so the proxy lives at this path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The open-application list (oldest `appliedAt` first).
 * @throws Error with visitor-facing copy on 401/403/503, other non-2xx, a
 * network failure, or a body that fails {@link fundingApplicationsResponseSchema}.
 */
export async function fetchFundingApplications(
  sessionToken: string,
): Promise<FundingApplication[]> {
  try {
    const response = await fetch('/funding/applications', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(FUNDING_APPLICATIONS_LOAD_ERROR);
    }
    return fundingApplicationsResponseSchema.parse(await response.json()).applications;
  } catch {
    throw new Error(FUNDING_APPLICATIONS_LOAD_ERROR);
  }
}

/**
 * Fetches one grant application for staff review.
 *
 * Hits same-origin `GET /funding/applications/:accountId` (Bearer).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param accountId - Subject account id.
 * @returns Account, grant, and living-room posts.
 * @throws Error with visitor-facing copy on 401/403/404/503, other non-2xx, a
 * network failure, or a body that fails {@link fundingApplicationDetailSchema}.
 */
export async function fetchFundingApplication(
  sessionToken: string,
  accountId: string,
): Promise<FundingApplicationDetail> {
  try {
    const response = await fetch(`/funding/applications/${encodeURIComponent(accountId)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(FUNDING_APPLICATION_LOAD_ERROR);
    }
    return fundingApplicationDetailSchema.parse(await response.json());
  } catch {
    throw new Error(FUNDING_APPLICATION_LOAD_ERROR);
  }
}

/**
 * Posts a staff funding decision with the signed-in session.
 *
 * @param path - Same-origin proxy path.
 * @param sessionToken - Bearer session.
 * @param accountId - Subject account id.
 * @returns Parsed {@link FundingDecisionResult}.
 * @throws Error with visitor-facing copy on any failure.
 */
async function postFundingAction(
  path: string,
  sessionToken: string,
  accountId: string,
): Promise<FundingDecisionResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accountId }),
    });
    if (!response.ok) {
      throw new Error(FUNDING_ACTION_ERROR);
    }
    return fundingDecisionResultSchema.parse(await response.json());
  } catch {
    throw new Error(FUNDING_ACTION_ERROR);
  }
}

/**
 * Admits a member to daily grant payouts (staff). Target pending or trial.
 *
 * @param sessionToken - Bearer session of a founder or moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postFundingAdmit(
  sessionToken: string,
  accountId: string,
): Promise<FundingDecisionResult> {
  return postFundingAction('/funding/admit', sessionToken, accountId);
}

/**
 * Rejects a grant application (staff). The subject may re-apply.
 *
 * @param sessionToken - Bearer session of a founder or moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postFundingReject(
  sessionToken: string,
  accountId: string,
): Promise<FundingDecisionResult> {
  return postFundingAction('/funding/reject', sessionToken, accountId);
}

/**
 * Fetches given and received activity for the signed-in account.
 *
 * Hits same-origin `GET /me/activity` (Bearer). Totals include house gifts and
 * forum zaps and do not require a Lightning Address.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The {@link AccountActivity} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link accountActivitySchema}.
 */
export async function fetchAccountActivity(sessionToken: string): Promise<AccountActivity> {
  try {
    const response = await fetch('/me/activity', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return accountActivitySchema.parse(await response.json());
  } catch {
    throw new Error('Could not load gift stats. Please try again.');
  }
}

/**
 * Fetches given and received activity for a signed-in member profile.
 *
 * Hits same-origin `GET /forum/members/:id/activity` (Bearer).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param accountId - Member account id.
 * @returns The {@link AccountActivity} payload.
 * @throws {@link MissingRequirementsError} on 409 `missing_requirements`.
 * @throws Error with visitor-facing copy on 401/404, other non-2xx, or a body
 * that fails {@link accountActivitySchema}.
 */
export async function fetchMemberActivity(
  sessionToken: string,
  accountId: string,
): Promise<AccountActivity> {
  try {
    const response = await fetch(`/forum/members/${encodeURIComponent(accountId)}/activity`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (response.status === 409) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Could not load gift stats. Please try again.');
      }
      const missing = parseMissingRequirements(body);
      if (missing !== null) {
        throw missing;
      }
      throw new Error('Could not load gift stats. Please try again.');
    }
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return accountActivitySchema.parse(await response.json());
  } catch (err) {
    if (err instanceof MissingRequirementsError) {
      throw err;
    }
    throw new Error('Could not load gift stats. Please try again.');
  }
}

/**
 * Fetches given and received activity for a public view-key profile.
 *
 * Hits same-origin `GET /view-key/:viewKey/activity` (no auth).
 *
 * @param viewKey - 64 lowercase hex capability key.
 * @returns The {@link AccountActivity} payload.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link accountActivitySchema}. Callers that keep the profile card
 * on an activity failure should catch and treat both series as empty.
 */
export async function fetchViewActivity(viewKey: string): Promise<AccountActivity> {
  try {
    const response = await fetch(`/view-key/${encodeURIComponent(viewKey)}/activity`);
    if (!response.ok) {
      throw new Error('Could not load gift stats. Please try again.');
    }
    return accountActivitySchema.parse(await response.json());
  } catch {
    throw new Error('Could not load gift stats. Please try again.');
  }
}

/** One cursor-paginated page of the forum feed. */
export type ForumFeedPage = { messages: ForumMessage[]; nextCursor: string | null };

/**
 * Fetches one page of public top-level forum messages (newest first).
 *
 * Sends `GET /forum/messages` with an optional mode, optional hashtag (the
 * name without a leading `#`), and cursor and an always present limit (20 by
 * default).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param args - Optional feed mode, hashtag name without `#`, page size, and
 * non-empty page cursor.
 * @returns The validated page; `nextCursor` is `null` when the response omits it.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link forumListSchema}.
 */
export async function fetchMessages(
  sessionToken: string,
  args: {
    mode?: 'active' | 'unpaid' | 'all' | 'popular';
    limit?: number;
    cursor?: string | null;
    hashtag?: string;
  } = {},
): Promise<ForumFeedPage> {
  try {
    const query = new URLSearchParams();
    if (args.mode !== undefined) {
      query.set('mode', args.mode);
    }
    if (args.hashtag !== undefined && args.hashtag !== '') {
      query.set('hashtag', args.hashtag);
    }
    query.set('limit', String(args.limit ?? 20));
    if (args.cursor !== undefined && args.cursor !== null && args.cursor !== '') {
      query.set('cursor', args.cursor);
    }
    const response = await fetch(`/forum/messages?${query.toString()}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (response.status === 409) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new Error('Could not load messages. Please try again.');
      }
      const missing = parseMissingRequirements(body);
      if (missing !== null) {
        throw missing;
      }
      throw new Error('Could not load messages. Please try again.');
    }
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const page = forumListSchema.parse(await response.json());
    return { messages: page.messages, nextCursor: page.nextCursor ?? null };
  } catch (err) {
    if (err instanceof MissingRequirementsError) {
      throw err;
    }
    throw new Error('Could not load messages. Please try again.');
  }
}

const HIDDEN_NOTES_ERROR = 'Could not load hidden notes. Please try again.';

/**
 * Fetches hidden forum notes for moderators.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The hidden-note list.
 * @throws Error on HTTP 401 or 403.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link hiddenListSchema}.
 */
export async function listHiddenMessages(sessionToken: string): Promise<HiddenMessage[]> {
  let response: Response;
  try {
    response = await fetch('/forum/messages/hidden', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
  } catch {
    throw new Error(HIDDEN_NOTES_ERROR);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Failed to list hidden notes: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(HIDDEN_NOTES_ERROR);
  }
  try {
    return hiddenListSchema.parse(await response.json()).messages;
  } catch {
    throw new Error(HIDDEN_NOTES_ERROR);
  }
}

/**
 * Signed-in single-note fetch (app path `/forum/messages/:id`).
 * Staff sessions receive soft-hidden rows; others get 404 → null.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Forum message UUID.
 * @returns The {@link ForumMessage}, or `null` when the id is unknown (404).
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchForumMessage(
  sessionToken: string,
  id: string,
): Promise<ForumMessage | null> {
  try {
    const response = await fetch(`/forum/messages/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return forumMessageSchema.parse(await response.json());
  } catch (err) {
    if (err instanceof Error && err.message === 'Could not load messages. Please try again.') {
      throw err;
    }
    /* Zod / network */
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches one public forum message without a session (HTML note page).
 * Optional `sinceSats` waits on the api until the note has more sats (pay poll).
 *
 * @param id - Forum message UUID.
 * @param opts - Optional `sinceSats` query and `AbortSignal` for the fetch.
 * @returns The {@link ForumMessage}, or `null` when the id is unknown (404) or
 * the request was aborted.
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchPublicMessage(
  id: string,
  opts?: { sinceSats?: number; signal?: AbortSignal },
): Promise<ForumMessage | null> {
  try {
    const sinceSats = opts?.sinceSats;
    const path = `/public-messages/${encodeURIComponent(id)}`;
    const url =
      sinceSats !== undefined && Number.isInteger(sinceSats) && sinceSats >= 0
        ? `${path}?sinceSats=${sinceSats}`
        : path;
    const signal = opts?.signal;
    const response = signal !== undefined ? await fetch(url, { signal }) : await fetch(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return forumMessageSchema.parse(await response.json());
  } catch (err) {
    if ((err instanceof Error && err.name === 'AbortError') || opts?.signal?.aborted) {
      return null;
    }
    if (err instanceof Error && err.message === 'Could not load messages. Please try again.') {
      throw err;
    }
    /* Zod / network */
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches live replies for one public forum note without a session (HTML thread).
 * Items that fail {@link forumMessageSchema} are skipped; none surviving
 * returns `[]`. HTTP 200 with an empty list returns `[]`. HTTP 404 is an
 * error (not empty): the parent GET already 404s unknown ids.
 *
 * @param id - Parent forum message UUID.
 * @returns Reply list oldest-first (Damus authors may omit role; schema
 * defaults to basis).
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * id is unknown (404), the body is not JSON, or the body is not
 * `{ messages: array }`.
 */
export async function fetchPublicReplies(id: string): Promise<ForumMessage[]> {
  try {
    const response = await fetch(`/public-messages/${encodeURIComponent(id)}/replies`);
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('messages' in body) ||
      !Array.isArray(body.messages)
    ) {
      throw new Error('Could not load messages. Please try again.');
    }
    const kept: ForumMessage[] = [];
    for (const item of body.messages) {
      const parsed = forumMessageSchema.safeParse(item);
      if (parsed.success) {
        kept.push(parsed.data);
      }
    }
    return kept;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches replies for one forum note (oldest first).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Parent forum message UUID.
 * @returns Reply list (Damus authors may omit role; schema defaults to basis).
 * Items that fail {@link forumMessageSchema} are skipped; none surviving
 * returns `[]`.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * body is not JSON, or the body is not `{ messages: array }`.
 */
export async function fetchReplies(sessionToken: string, id: string): Promise<ForumMessage[]> {
  try {
    const response = await fetch(`/forum/messages/${encodeURIComponent(id)}/replies`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('messages' in body) ||
      !Array.isArray(body.messages)
    ) {
      throw new Error('Could not load messages. Please try again.');
    }
    const kept: ForumMessage[] = [];
    for (const item of body.messages) {
      const parsed = forumMessageSchema.safeParse(item);
      if (parsed.success) {
        kept.push(parsed.data);
      }
    }
    return kept;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Posts a new public forum message (text and/or up to ten photos), or a reply.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param input - Trimmed text, optional legacy `photo`, optional `photos`, and
 * optional `inReplyTo` parent id (thread composer only; omit for top-level notes).
 * @returns The created {@link ForumMessage}.
 * @throws Error when the api rejects the body (400, 403, or 429) — the api
 * error string when present, otherwise a fallback — {@link MissingRequirementsError}
 * on 409, on any other non-2xx status, or when the body fails
 * {@link forumMessageSchema} validation.
 */
export async function postMessage(
  sessionToken: string,
  input: {
    text: string;
    photo?: { contentType: string; data: string };
    photos?: { contentType: string; data: string }[];
    inReplyTo?: string;
  },
): Promise<ForumMessage> {
  const stills =
    input.photos !== undefined
      ? input.photos.slice(0, 10)
      : input.photo !== undefined
        ? [input.photo]
        : [];
  const response = await fetch('/forum/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      ...(stills.length === 0 ? {} : { photo: stills[0], photos: stills }),
      ...(input.inReplyTo !== undefined && input.inReplyTo !== ''
        ? { inReplyTo: input.inReplyTo }
        : {}),
    }),
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not post your message' : toUserFacingError(raw));
  }
  if (response.status === 403) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'A reply needs a Bitcoin payment' : toUserFacingError(raw));
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not post your message');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not post your message');
  }
  if (!response.ok) {
    throw new Error('Could not post your message');
  }
  return forumMessageSchema.parse(await response.json());
}

/**
 * Posts a forum message with a video file (multipart) and optional poster.
 *
 * @param sessionToken - Bearer session.
 * @param input - Text, video file, optional JPEG poster.
 * @returns The created {@link ForumMessage}.
 * @throws Error when the api rejects the body (400 or 429) — the api error
 * string when present, otherwise a fallback — on any other non-2xx status, or
 * when the body fails {@link forumMessageSchema} validation.
 */
export async function postMessageVideo(
  sessionToken: string,
  input: { text: string; video: File; poster?: Blob },
): Promise<ForumMessage> {
  const form = new FormData();
  form.set('text', input.text);
  form.set('video', input.video);
  if (input.poster !== undefined) {
    form.set('poster', input.poster, 'poster.jpg');
  }
  const response = await fetch('/forum/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: form,
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not post your message' : toUserFacingError(raw));
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not post your message');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not post your message');
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
 * @param text - Optional NIP-57 comment shown as the gift reply body.
 * @returns `{ pr, amountSats }` for QR / Wallet of Satoshi.
 * @throws Error with collapsed visitor copy on 400/404/429/503 (and other
 * non-2xx), {@link MissingRequirementsError} on 409, or when the body fails
 * {@link messageInvoiceSchema}.
 */
export async function postMessageInvoice(
  sessionToken: string,
  messageId: string,
  sats: number,
  text?: string,
): Promise<MessageInvoice> {
  const response = await fetch(`/messages/${encodeURIComponent(messageId)}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(text === undefined || text === '' ? { sats } : { sats, text }),
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not start the Bitcoin payment' : toUserFacingError(raw));
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not start the Bitcoin payment');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not start the Bitcoin payment');
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
 * Posts an in-app contact message to 21.gifts.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param text - Message body as typed (api trims and validates length).
 * @returns The created {@link ContactMessage}.
 * @throws Error when the api rejects the text (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link contactSchema} validation.
 */
export async function postContact(sessionToken: string, text: string): Promise<ContactMessage> {
  const response = await fetch('/contact/submit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not send your message' : toUserFacingError(raw));
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not send your message');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not send your message');
  }
  if (!response.ok) {
    throw new Error('Could not send your message');
  }
  return contactSchema.parse(await response.json());
}

/**
 * Fetches private-message threads the session may see (own threads, plus
 * official 21.gifts threads when the role is at least moderator).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns Threads newest-last-message first.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link conversationListSchema}.
 */
export async function fetchConversations(sessionToken: string): Promise<Conversation[]> {
  try {
    const response = await fetch('/conversations', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return conversationListSchema.parse(await response.json()).conversations;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches the closed moderator-group thread for a moderator.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The singleton {@link Conversation} row.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link conversationResponseSchema}.
 */
export async function fetchModeratorGroup(sessionToken: string): Promise<Conversation> {
  try {
    const response = await fetch('/conversations/moderator-group', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return conversationResponseSchema.parse(await response.json()).conversation;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches messages in one private thread (oldest first).
 *
 * When `sinceMessageId` is a non-empty string, the api long-polls until that
 * id exists (or times out). `AbortError` is rethrown so the inbox pay poll
 * can treat cancel as a non-error.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @param opts - Optional `sinceMessageId` query and `AbortSignal` for the fetch.
 * @returns Message list.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * thread is missing, or the body fails {@link conversationThreadSchema}.
 * Re-throws `AbortError` when the request was aborted.
 */
export async function fetchConversation(
  sessionToken: string,
  id: string,
  opts?: { sinceMessageId?: string; signal?: AbortSignal },
): Promise<ConversationMessage[]> {
  try {
    const sinceMessageId = opts?.sinceMessageId;
    const path = `/conversations/${encodeURIComponent(id)}`;
    const url =
      sinceMessageId !== undefined && sinceMessageId !== ''
        ? `${path}?sinceMessageId=${encodeURIComponent(sinceMessageId)}`
        : path;
    const init: RequestInit = {
      headers: { Authorization: `Bearer ${sessionToken}` },
    };
    if (opts?.signal !== undefined) {
      init.signal = opts.signal;
    }
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return conversationThreadSchema.parse(await response.json()).messages;
  } catch (err) {
    if ((err instanceof Error && err.name === 'AbortError') || opts?.signal?.aborted) {
      throw err instanceof Error && err.name === 'AbortError'
        ? err
        : new DOMException('The operation was aborted.', 'AbortError');
    }
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Requests a BOLT11 invoice to send bitcoin in a private thread.
 *
 * The api creates the predetermined `messageId` up front; the gift row
 * appears only after payment is confirmed. Empty `text` is omitted.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @param sats - Whole satoshis to pay (≥ 1).
 * @param text - Optional comment shown as the gift body.
 * @returns `{ pr, amountSats, messageId }` for QR / Wallet of Satoshi and poll.
 * @throws Error with collapsed visitor copy on 400/404/429/503 (and other
 * non-2xx), {@link MissingRequirementsError} on 409, or when the body fails
 * {@link conversationInvoiceSchema}.
 */
export async function postConversationInvoice(
  sessionToken: string,
  id: string,
  sats: number,
  text?: string,
): Promise<ConversationInvoice> {
  const response = await fetch(`/conversations/${encodeURIComponent(id)}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(text === undefined || text === '' ? { sats } : { sats, text }),
  });
  if (response.status === 400 || response.status === 429) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not start the Bitcoin payment' : toUserFacingError(raw));
  }
  if (response.status === 409) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Could not start the Bitcoin payment');
    }
    const missing = parseMissingRequirements(body);
    if (missing !== null) {
      throw missing;
    }
    throw new Error('Could not start the Bitcoin payment');
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
  return conversationInvoiceSchema.parse(await response.json());
}

/**
 * Appends a private message to an existing thread.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @param text - Message body as typed (api trims and validates length).
 * @param photos - Optional JPEG/PNG/WebP stills (`contentType` + raw base64 `data`).
 *   When non-empty, the JSON body also sends `photo` (first still) and
 *   `photos` (all stills, max 10). Omitted for existing 3-argument callers.
 * @returns The created {@link ConversationMessage}.
 * @throws Error when the api rejects the text (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link conversationMessageSchema} validation.
 */
export async function postConversationMessage(
  sessionToken: string,
  id: string,
  text: string,
  photos?: { contentType: string; data: string }[],
): Promise<ConversationMessage> {
  const stills = photos !== undefined && photos.length > 0 ? photos.slice(0, 10) : [];
  const response = await fetch(`/conversations/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      ...(stills.length === 0 ? {} : { photo: stills[0], photos: stills }),
    }),
  });
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not send your message' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not send your message');
  }
  return conversationMessageSchema.parse(await response.json());
}

/**
 * Fetches the JPEG/PNG/WebP bytes for one indexed conversation message photo.
 *
 * Auth is a Bearer token in JS memory, so callers must use the returned blob
 * (for example via `URL.createObjectURL`) instead of an `<img src>` to the
 * same-origin photo path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param conversationId - Conversation UUID.
 * @param messageId - Conversation message id.
 * @param index - Zero-based photo index. Index zero uses the legacy route.
 * @returns The photo body as a `Blob`.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * response is empty — same family as {@link fetchMessagePhoto}; does not leak
 * status.
 */
export async function fetchConversationMessagePhoto(
  sessionToken: string,
  conversationId: string,
  messageId: string,
  index = 0,
): Promise<Blob> {
  try {
    const base = `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/photo`;
    const response = await fetch(index <= 0 ? base : `${base}/${index}.jpg`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Could not load messages. Please try again.');
    }
    return blob;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Opens or returns the private thread with a forum note's author.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param forumMessageId - Forum note or reply UUID.
 * @returns The {@link Conversation} list row for that thread.
 * @throws Error when the note is unknown (404), the author is the session
 * account (400), on any other non-2xx, or when the body fails
 * {@link conversationSchema}.
 */
export async function openConversation(
  sessionToken: string,
  forumMessageId: string,
): Promise<Conversation> {
  const response = await fetch('/conversations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ forumMessageId }),
  });
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not send your message' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not send your message');
  }
  return conversationSchema.parse(await response.json());
}

/**
 * Marks one private-message thread as read.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @returns Nothing on success.
 * @throws Error with visitor-facing copy when the api is unavailable.
 */
export async function markConversationRead(sessionToken: string, id: string): Promise<void> {
  try {
    const response = await fetch(`/conversations/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not mark conversation as read');
    }
  } catch {
    throw new Error('Could not mark conversation as read');
  }
}

/**
 * Fetches notifications (living-room posts, replies, and payments) for the signed-in session.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns `{ notifications, unreadCount }` newest-first from the api.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link notificationListSchema}.
 */
export async function fetchNotifications(sessionToken: string): Promise<NotificationList> {
  try {
    const response = await fetch('/forum/notifications', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load notifications. Please try again.');
    }
    return notificationListSchema.parse(await response.json());
  } catch {
    throw new Error('Could not load notifications. Please try again.');
  }
}

/**
 * Marks one notification as read.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Notification id.
 * @returns The updated {@link Notification} with `readAt` set.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link notificationSchema}.
 */
export async function markNotificationRead(
  sessionToken: string,
  id: string,
): Promise<Notification> {
  try {
    const response = await fetch(`/forum/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not mark notification as read');
    }
    return notificationSchema.parse(await response.json());
  } catch {
    throw new Error('Could not mark notification as read');
  }
}

/**
 * Marks every notification as read for the session.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns Nothing on success.
 * @throws Error with visitor-facing copy when the api is unavailable.
 */
export async function markAllNotificationsRead(sessionToken: string): Promise<void> {
  try {
    const response = await fetch('/forum/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not mark notifications as read');
    }
  } catch {
    throw new Error('Could not mark notifications as read');
  }
}

/**
 * Fetches the JPEG/PNG/WebP bytes for one indexed forum message photo.
 *
 * Auth is a Bearer token in JS memory, so callers must use the returned blob
 * (for example via `URL.createObjectURL`) instead of an `<img src>` to the
 * same-origin photo path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Forum message id.
 * @param index - Zero-based photo index. Index zero uses the legacy route.
 * @returns The photo body as a `Blob`.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * response is empty — same family as {@link fetchMessages}; does not leak status.
 */
export async function fetchMessagePhoto(
  sessionToken: string,
  id: string,
  index = 0,
): Promise<Blob> {
  try {
    const base = `/messages/${encodeURIComponent(id)}/photo`;
    const response = await fetch(index <= 0 ? base : `${base}/${index}.jpg`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Could not load messages. Please try again.');
    }
    return blob;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches an indexed forum message photo without a session (public note page).
 *
 * Api `GET /messages/:id/photo` is public; the same-origin proxy forwards
 * without Authorization. Callers must use a blob URL, not a bare `<img src>`.
 *
 * @param id - Forum message id.
 * @param index - Zero-based photo index. Index zero uses the legacy route.
 * @returns The photo body as a `Blob`.
 * @throws Error with visitor-facing copy when the api is unavailable or empty.
 */
export async function fetchPublicMessagePhoto(id: string, index = 0): Promise<Blob> {
  try {
    const base = `/messages/${encodeURIComponent(id)}/photo`;
    const response = await fetch(index <= 0 ? base : `${base}/${index}.jpg`);
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Could not load messages. Please try again.');
    }
    return blob;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Fetches the VAPID application server public key for Web Push subscribe.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The url-safe base64 public key string.
 * @throws Error with message `Push is not configured` on 503, on any other
 * non-2xx status, or when the body fails {@link vapidPublicSchema} validation.
 */
export async function fetchVapidPublicKey(sessionToken: string): Promise<string> {
  const response = await fetch('/push/vapid-public', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status === 503) {
    throw new Error('Push is not configured');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch VAPID public key: ${response.status}`);
  }
  return vapidPublicSchema.parse(await response.json()).publicKey;
}

/**
 * Registers a Web Push subscription for the signed-in account.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param sub - Browser subscription endpoint plus p256dh/auth keys.
 * @throws Error with message `Push is not configured` on 503, when the api
 * rejects the body (400) — the api error string when present — on any other
 * non-2xx status, or when the body fails {@link pushSubscriptionResponseSchema}.
 */
export async function postPushSubscription(
  sessionToken: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  const response = await fetch('/me/push-subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sub),
  });
  if (response.status === 503) {
    throw new Error('Push is not configured');
  }
  if (response.status === 400) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Invalid subscription' : toUserFacingError(raw));
  }
  if (!response.ok) {
    throw new Error('Could not save push subscription');
  }
  pushSubscriptionResponseSchema.parse(await response.json());
}

/**
 * Removes a Web Push subscription for the signed-in account.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param endpoint - The Push API endpoint URL to delete.
 * @throws Error with message `Push is not configured` on 503, or on any other
 * non-2xx status other than 404 (already gone is treated as success).
 */
export async function deletePushSubscription(
  sessionToken: string,
  endpoint: string,
): Promise<void> {
  const response = await fetch('/me/push-subscriptions', {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ endpoint }),
  });
  if (response.status === 404) {
    return;
  }
  if (response.status === 503) {
    throw new Error('Push is not configured');
  }
  if (!response.ok) {
    throw new Error('Could not remove push subscription');
  }
}

/**
 * Starts a passkey registration ceremony.
 *
 * @param viewKey - Optional 64-hex public view key to claim an existing profile.
 * When set (non-empty), POSTs JSON `{ viewKey }`; otherwise POSTs with no body.
 * @returns Challenge id plus WebAuthn creation options JSON.
 * @throws Error with the api `{ error }` string when present on non-2xx, otherwise
 * a status fallback; or when the body fails validation.
 */
export async function startPasskeyRegistration(viewKey?: string): Promise<PasskeyBegin> {
  const response =
    viewKey !== undefined && viewKey !== ''
      ? await fetch('/auth/passkey/register/begin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewKey }),
        })
      : await fetch('/auth/passkey/register/begin', { method: 'POST' });
  if (!response.ok) {
    const raw = await readApiError(response);
    throw new Error(
      raw === null ? `Failed to start passkey registration: ${response.status}` : raw,
    );
  }
  return passkeyBeginSchema.parse(await response.json());
}

/**
 * Completes passkey registration and issues a session.
 *
 * @param challengeId - Id returned by {@link startPasskeyRegistration}.
 * @param credential - Browser attestation JSON (`PublicKeyCredential.toJSON()`).
 * @returns Token plus account (`linkingKey` is null).
 * @throws {@link WrongAccountError} on 403 with the duplicate-account api string.
 * @throws Error on any other non-2xx status or a body that fails validation.
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
  await throwIfWrongAccount(response);
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
 * @throws {@link WrongAccountError} on 403 with the duplicate-account api string.
 * @throws Error on any other non-2xx status or a body that fails validation.
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
  await throwIfWrongAccount(response);
  if (!response.ok) {
    throw new Error(`Failed to finish passkey authentication: ${response.status}`);
  }
  return passkeySessionSchema.parse(await response.json());
}

/**
 * Deletes a forum post and its replies using a moderator session.
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum post UUID.
 * @returns Resolves after deletion (an already missing post is also complete).
 * @throws Error on denied or failed deletion.
 */
export async function deleteMessage(sessionToken: string, messageId: string): Promise<void> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (response.status !== 204 && response.status !== 404) {
    throw new Error('Message deletion failed');
  }
}
