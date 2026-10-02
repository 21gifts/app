import { z } from 'zod';
import { closeLocalPushNotifications, currentPushEndpoint } from '@/lib/push';
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
  externalAuthorProfileSchema,
  forumPlacesResponseSchema,
  hiddenListSchema,
  lnAddressResolvedSchema,
  lnurlInvoiceSchema,
  lnurlPayRequestSchema,
  giftDaySchema,
  giftStatsSchema,
  shopActivitySchema,
  grantContinuationSchema,
  postStatsSchema,
  accountActivitySchema,
  memberProfileSchema,
  messageInvoiceSchema,
  moderatorProposalsResponseSchema,
  fundingApplyResponseSchema,
  fundingApplicationDetailSchema,
  fundingApplicationsResponseSchema,
  fundingPayoutDaysResponseSchema,
  fundingDecisionResultSchema,
  dailyRosterSchema,
  trustActionResultSchema,
  trustChainSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  pushSubscriptionResponseSchema,
  vapidPublicSchema,
  viewProfileSchema,
  type Account,
  type AmountUnit,
  type NotificationLevel,
  type ContactMessage,
  type Conversation,
  type ConversationInvoice,
  type ConversationMessage,
  type Notification,
  type NotificationList,
  type ForumMessage,
  type ExternalAuthorProfile,
  type ForumPlacePin,
  type ForumPlaceRow,
  type HiddenMessage,
  type GiftDay,
  type GiftStats,
  type ShopActivityDay,
  type GrantContinuation,
  type PostStats,
  type AccountActivity,
  type LnAddressResolved,
  type LnurlInvoice,
  type LnurlPayRequest,
  type MemberProfile,
  type MessageInvoice,
  type ModeratorProposal,
  type FundingApplication,
  type FundingApplicationDetail,
  type FundingPayoutDays,
  type FundingDecisionResult,
  type DailyRoster,
  type OwnerFunding,
  type PasskeyBegin,
  type PasskeySession,
  type TrustActionResult,
  type TrustChain,
  type ForumGoalCurrency,
  type ViewProfile,
} from '@/lib/api-types';
import type { Locale } from '@/lib/locale';
import { MissingRequirementsError, parseMissingRequirements } from '@/lib/missing-requirements';
import { shortLinkPath } from '@/lib/short-link';
import type { FiatCode } from '@/lib/stats-money';

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
 * Api 404 on a missing or deleted forum note (reply parent or invoice target).
 */
export class NoteDeletedError extends Error {
  constructor() {
    super('This note was deleted');
    this.name = 'NoteDeletedError';
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

/**
 * Exact api 400 body when authenticate finish does not know the offered credential.
 * Matched literally (English).
 */
export const UNKNOWN_CREDENTIAL_ERROR = 'Unknown credential';

/**
 * Api 400 rejection when authenticate finish does not know the offered credential.
 */
export class UnknownCredentialError extends Error {
  /**
   * @returns An unknown-credential error with the api's exact English copy.
   */
  public constructor() {
    super(UNKNOWN_CREDENTIAL_ERROR);
    this.name = 'UnknownCredentialError';
  }
}

/**
 * True for {@link UnknownCredentialError} or any `Error` whose message is exactly
 * {@link UNKNOWN_CREDENTIAL_ERROR}.
 *
 * @param error - Unknown rejection.
 * @returns Whether the offered credential is unknown to the server.
 */
export function isUnknownCredentialError(error: unknown): boolean {
  return (
    error instanceof UnknownCredentialError ||
    (error instanceof Error && error.message === UNKNOWN_CREDENTIAL_ERROR)
  );
}

/** Device IANA zone for the Sunday write check. Empty when the runtime has none. */
export function deviceTimeZoneHeader(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof zone !== 'string' || zone.trim() === '') {
      return {};
    }
    return { 'Time-Zone': zone };
  } catch {
    return {};
  }
}

/**
 * Header for a public write. Setup omits it so onboarding is not refused.
 *
 * @param mode - `setup` for onboarding saves; `enforce` for profile edits.
 * @returns The `Time-Zone` header, or an empty object during setup.
 */
function sundayWriteHeaders(mode: 'enforce' | 'setup'): Record<string, string> {
  if (mode === 'setup') {
    return {};
  }
  return deviceTimeZoneHeader();
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
 * @param sundayWrite - `setup` omits `Time-Zone` so onboarding is not refused.
 * @returns The updated {@link Account}.
 * @throws Error when the api rejects the name (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link accountSchema} validation.
 */
export async function setName(
  sessionToken: string,
  name: string,
  sundayWrite: 'enforce' | 'setup' = 'enforce',
): Promise<Account> {
  const response = await fetch('/me/name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...sundayWriteHeaders(sundayWrite),
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
      ...deviceTimeZoneHeader(),
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
  photo?: { contentType: string; data: string; takenAt?: string | null } | null,
): Promise<Account> {
  const response = await fetch('/me/about', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({
      text,
      ...(photo === undefined
        ? {}
        : {
            photo:
              photo === null
                ? null
                : {
                    contentType: photo.contentType,
                    data: photo.data,
                    ...(typeof photo.takenAt === 'string' && photo.takenAt !== ''
                      ? { takenAt: photo.takenAt }
                      : {}),
                  },
          }),
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
 * Stores or clears the signed-in account's profile photo.
 *
 * Not the wide image and not the About me note photo.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param photo - JPEG payload, or `null` to clear.
 * @throws Error `'Could not save. Please try again.'` on a non-2xx response.
 */
export async function putProfilePhoto(
  sessionToken: string,
  photo: { contentType: string; data: string } | null,
): Promise<void> {
  const response = await fetch('/pictures/me', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      photo: photo === null ? null : { contentType: photo.contentType, data: photo.data },
    }),
  });
  if (!response.ok) {
    throw new Error('Could not save. Please try again.');
  }
}

/**
 * Fetches the signed-in account's profile photo.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The image as a Blob.
 * @throws Error `'Could not load. Please try again.'` on a non-ok response,
 * an empty blob, or a network failure.
 */
export async function fetchProfilePhoto(sessionToken: string): Promise<Blob> {
  try {
    const response = await fetch('/pictures/me', {
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
 * Stores or clears the signed-in account's wide profile image.
 *
 * The About me photo is unchanged. `null` clears the wide image.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param photo - JPEG payload, or `null` to clear.
 * @throws Error `'Could not save. Please try again.'` on a non-2xx response.
 */
export async function putWideBanner(
  sessionToken: string,
  photo: { contentType: string; data: string } | null,
): Promise<void> {
  const response = await fetch('/banners/me', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      photo:
        photo === null
          ? null
          : {
              contentType: photo.contentType,
              data: photo.data,
            },
    }),
  });
  if (!response.ok) {
    throw new Error('Could not save. Please try again.');
  }
}

/**
 * Fetches the signed-in account's wide profile image.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The image as a Blob.
 * @throws Error `'Could not load. Please try again.'` on a non-ok response,
 * an empty blob, or a network failure.
 */
export async function fetchWideBanner(sessionToken: string): Promise<Blob> {
  try {
    const response = await fetch('/banners/me', {
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
 * @param sundayWrite - `setup` omits `Time-Zone` so onboarding is not refused.
 * @returns The updated {@link Account}.
 * @throws Error with visitor-facing copy on 400/409 or other failures.
 */
export async function setUsername(
  sessionToken: string,
  username: string,
  sundayWrite: 'enforce' | 'setup' = 'enforce',
): Promise<Account> {
  const response = await fetch('/me/username', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...sundayWriteHeaders(sundayWrite),
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
 * Claims the in-app wallet's identity public key for the account.
 *
 * @param sessionToken - Bearer session.
 * @param sparkPubkey - Wallet identity public key (66 lower-case hex).
 * @returns The updated {@link Account}.
 * @throws Error `wallet-verified` on 409 (the account's wallet is already
 * verified), `wallet-unavailable` on 404 (the feature is off), and
 * `wallet-request` on any other failure or an invalid body.
 */
export async function putWallet(sessionToken: string, sparkPubkey: string): Promise<Account> {
  const response = await fetch('/me/wallet', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sparkPubkey }),
  });
  if (response.status === 409) {
    throw new Error('wallet-verified');
  }
  if (response.status === 404) {
    throw new Error('wallet-unavailable');
  }
  if (!response.ok) {
    throw new Error('wallet-request');
  }
  const parsed = accountSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new Error('wallet-request');
  }
  return parsed.data;
}

/**
 * Links or replaces the account's receiving Lightning Address.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param address - The `name@domain.tld` Lightning Address to store.
 * @param sundayWrite - `setup` omits `Time-Zone` so onboarding is not refused.
 * @returns The updated {@link Account}.
 * @throws Error when the api rejects the address (400) — rewritten to
 * visitor-facing copy — on any other non-2xx status, or when the body fails
 * {@link accountSchema} validation.
 */
export async function setLightningAddress(
  sessionToken: string,
  address: string,
  sundayWrite: 'enforce' | 'setup' = 'enforce',
): Promise<Account> {
  const response = await fetch('/me/lightning-address', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...sundayWriteHeaders(sundayWrite),
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
    headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
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
 * Sets the signed-in account amount unit.
 *
 * @param session - A bearer token from a completed challenge.
 * @param unit - `btc` or `fiat`.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function setAmountUnit(session: string, unit: AmountUnit): Promise<Account> {
  const response = await fetch('/me/amount-unit', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unit }),
  });
  if (!response.ok) {
    throw new Error('Could not save amount unit.');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Sets the signed-in account language.
 *
 * @param session - A bearer token from a completed challenge.
 * @param locale - Supported UI language.
 * @param onlyIfUnset - Whether an existing account value must win.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function setAccountLocale(
  session: string,
  locale: Locale,
  onlyIfUnset: boolean,
): Promise<Account> {
  const response = await fetch('/me/locale', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locale, onlyIfUnset }),
  });
  if (!response.ok) {
    throw new Error('Could not save language.');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Sets the signed-in account preferred currency.
 *
 * @param session - A bearer token from a completed challenge.
 * @param fiat - Supported fiat code.
 * @param onlyIfUnset - Whether an existing account value must win.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}
 * validation.
 */
export async function setAccountFiat(
  session: string,
  fiat: FiatCode,
  onlyIfUnset: boolean,
): Promise<Account> {
  const response = await fetch('/me/fiat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fiat, onlyIfUnset }),
  });
  if (!response.ok) {
    throw new Error('Could not save currency.');
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

/**
 * Fetches public shop counts per UTC day. No session.
 *
 * @returns The 30 {@link ShopActivityDay} rows, oldest first.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link shopActivitySchema}.
 */
export async function fetchShopActivity(): Promise<ShopActivityDay[]> {
  try {
    const response = await fetch('/shops/activity');
    if (!response.ok) {
      throw new Error('Could not load shop activity. Please try again.');
    }
    return shopActivitySchema.parse(await response.json()).days;
  } catch {
    throw new Error('Could not load shop activity. Please try again.');
  }
}

const GRANT_GOAL_LOAD_ERROR = 'Could not load the shop goal. Please try again.';

/**
 * Fetches the signed-in grant goal: shops per UTC day for the last 7 days,
 * and how many shops meet 5 of those days.
 *
 * Does not call {@link fetchShopActivity}.
 *
 * @param sessionToken - Bearer session from a completed login.
 * @returns The 7-day series and `qualifyingShops`.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link grantContinuationSchema}.
 */
export async function fetchGrantContinuation(sessionToken: string): Promise<GrantContinuation> {
  try {
    const response = await fetch('/funding/goal', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(GRANT_GOAL_LOAD_ERROR);
    }
    return grantContinuationSchema.parse(await response.json());
  } catch {
    throw new Error(GRANT_GOAL_LOAD_ERROR);
  }
}

/**
 * Fetches public forum activity. Notes and replies are already one count.
 *
 * @returns Living notes plus replies, by UTC day.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link postStatsSchema}.
 */
export async function fetchPostStats(): Promise<PostStats> {
  try {
    const response = await fetch('/messages/stats');
    if (!response.ok) {
      throw new Error('Could not load post stats. Please try again.');
    }
    return postStatsSchema.parse(await response.json());
  } catch {
    throw new Error('Could not load post stats. Please try again.');
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
 * @param extra - Optional Verify-only `{ confirmedName }`. Omitted, the body is `{ accountId }`.
 * @returns Parsed {@link TrustActionResult}.
 * @throws Error with visitor-facing copy on any failure.
 */
async function postTrustAction(
  path: string,
  sessionToken: string,
  accountId: string,
  extra?: { confirmedName: string },
): Promise<TrustActionResult> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        ...deviceTimeZoneHeader(),
      },
      body: JSON.stringify(extra === undefined ? { accountId } : { accountId, ...extra }),
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
 * @param confirmedName - Stored name that uniquely identifies the person.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustVerify(
  sessionToken: string,
  accountId: string,
  confirmedName: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/verify', sessionToken, accountId, { confirmedName });
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
 * Rejects a pending moderator proposal.
 *
 * @param sessionToken - Bearer session of a moderator.
 * @param accountId - Subject account id.
 * @returns The updated account snapshot.
 * @throws Error with visitor-facing copy on 401/403/404/409/503 or any other failure.
 */
export async function postTrustReject(
  sessionToken: string,
  accountId: string,
): Promise<TrustActionResult> {
  return postTrustAction('/trust/reject-moderator', sessionToken, accountId);
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
const FUNDING_PAYOUT_DAYS_LOAD_ERROR = 'Could not load the payout table. Please try again.';
const FUNDING_ACTION_ERROR = 'Could not update this member. Please try again.';
const FUNDING_DAILY_ROSTER_LOAD_ERROR = 'Could not load daily payments. Please try again.';
const FUNDING_DAILY_ROSTER_SAVE_ERROR = 'funding.daily.saveError';

/** Exact api English mapped to catalog keys so the UI never shows that English. */
const DAILY_ROSTER_API_SAVE_ERRORS: Record<string, string> = {
  'Invalid comment': 'funding.daily.invalidComment',
  'Invalid payments switch': 'funding.daily.invalidSwitch',
  'Invalid address or amount': 'funding.daily.invalidRow',
  'Invalid person or amount': 'funding.daily.invalidPerson',
  'Address already listed': 'funding.daily.duplicate',
  'Unknown address': 'funding.daily.unknown',
  'Unknown person': 'funding.daily.unknownPerson',
  'Person has no Lightning address': 'funding.daily.noLightning',
};

const DAILY_ROSTER_SAVE_KEYS = new Set([
  'funding.daily.invalidComment',
  'funding.daily.invalidSwitch',
  'funding.daily.invalidRow',
  'funding.daily.invalidPerson',
  'funding.daily.duplicate',
  'funding.daily.unknown',
  'funding.daily.unknownPerson',
  'funding.daily.noLightning',
  FUNDING_DAILY_ROSTER_SAVE_ERROR,
]);

/**
 * Maps an api `{ error }` string to a daily-roster save catalog key.
 *
 * @param raw - Api English, or `null` when the body is not that envelope.
 * @returns A `funding.daily.*` key. Never the raw api English.
 */
function dailyRosterSaveErrorKey(raw: string | null): string {
  if (raw === null) {
    return FUNDING_DAILY_ROSTER_SAVE_ERROR;
  }
  return DAILY_ROSTER_API_SAVE_ERRORS[raw] ?? FUNDING_DAILY_ROSTER_SAVE_ERROR;
}

/**
 * Posts a daily-roster mutation and parses the returned {@link DailyRoster}.
 *
 * @param path - Same-origin proxy path.
 * @param session - Bearer session.
 * @param body - JSON body for the proxy.
 * @returns The updated roster.
 * @throws Error whose message is a `funding.daily.*` catalog key.
 */
async function postDailyRoster(path: string, session: string, body: unknown): Promise<DailyRoster> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(dailyRosterSaveErrorKey(await readApiError(response)));
    }
    return dailyRosterSchema.parse(await response.json());
  } catch (err) {
    if (err instanceof Error && DAILY_ROSTER_SAVE_KEYS.has(err.message)) {
      throw err;
    }
    throw new Error(FUNDING_DAILY_ROSTER_SAVE_ERROR);
  }
}

/**
 * Applies for the 21 gifts grant (verified and above).
 *
 * Hits same-origin `POST /funding/apply` (Bearer). Role `basis` is 403.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The updated {@link OwnerFunding} object.
 * @throws Error with the API string on 400 `About me is required`,
 * `About me photo is required`, or `Location is required`. Other 401/403/409/503,
 * other non-2xx, a network failure, or a body that fails
 * {@link fundingApplyResponseSchema} use visitor-facing copy.
 */
export async function postFundingApply(sessionToken: string): Promise<OwnerFunding> {
  try {
    const response = await fetch('/funding/apply', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
        ...deviceTimeZoneHeader(),
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      if (response.status === 400) {
        const raw = await readApiError(response);
        throw new Error(raw === null ? FUNDING_APPLY_ERROR : raw);
      }
      throw new Error(FUNDING_APPLY_ERROR);
    }
    return fundingApplyResponseSchema.parse(await response.json()).funding;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'About me is required' ||
        err.message === 'About me photo is required' ||
        err.message === 'Location is required')
    ) {
      throw err;
    }
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
 * Fetches the seven-day payout table for moderators.
 *
 * Hits same-origin `GET /funding/payout-days` (Bearer). Next.js forbids a
 * `route.ts` beside `/moderate/payouts`, so the proxy lives at this path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The parsed payload (`days` plus `rows`), oldest day first.
 * @throws Error with visitor-facing copy on 401/403/503, other non-2xx, a
 * network failure, or a body that fails {@link fundingPayoutDaysResponseSchema}.
 */
export async function fetchFundingPayoutDays(sessionToken: string): Promise<FundingPayoutDays> {
  try {
    const response = await fetch('/funding/payout-days', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(FUNDING_PAYOUT_DAYS_LOAD_ERROR);
    }
    return fundingPayoutDaysResponseSchema.parse(await response.json());
  } catch {
    throw new Error(FUNDING_PAYOUT_DAYS_LOAD_ERROR);
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
        ...deviceTimeZoneHeader(),
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
 * Fetches the daily payout roster for founder and initiator editors.
 *
 * Hits same-origin `GET /funding/daily-roster` (Bearer). Next.js forbids a
 * `route.ts` beside `/grants/payments/comment` and `/grants/payments/amounts`,
 * so the proxy lives at this path.
 *
 * @param session - A bearer token from a completed challenge.
 * @returns The parsed {@link DailyRoster}.
 * @throws Error `'funding.daily.forbidden'` on 403 with api `Forbidden`.
 * @throws Error with visitor-facing copy on 401, other 403, 503, other non-2xx, a
 * network failure, or a body that fails {@link dailyRosterSchema}.
 */
export async function fetchDailyRoster(session: string): Promise<DailyRoster> {
  try {
    const response = await fetch('/funding/daily-roster', {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!response.ok) {
      if (response.status === 403 && (await readApiError(response)) === 'Forbidden') {
        throw new Error('funding.daily.forbidden');
      }
      throw new Error(FUNDING_DAILY_ROSTER_LOAD_ERROR);
    }
    return dailyRosterSchema.parse(await response.json());
  } catch (err) {
    if (err instanceof Error && err.message === 'funding.daily.forbidden') {
      throw err;
    }
    throw new Error(FUNDING_DAILY_ROSTER_LOAD_ERROR);
  }
}

/**
 * Saves the daily payout comment.
 *
 * Hits same-origin `POST /funding/daily-roster/comment` with `{ comment }`.
 *
 * @param session - Bearer session.
 * @param comment - Comment text as typed.
 * @returns The updated {@link DailyRoster}.
 * @throws Error whose message is a `funding.daily.*` catalog key. Maps
 * `Invalid comment` to `funding.daily.invalidComment`.
 */
export async function saveDailyRosterComment(
  session: string,
  comment: string,
): Promise<DailyRoster> {
  return postDailyRoster('/funding/daily-roster/comment', session, { comment });
}

/**
 * Sets whether daily payments are on.
 *
 * Hits same-origin `POST /funding/daily-roster/payments` with `{ enabled }`.
 *
 * @param session - Bearer session.
 * @param enabled - `true` to turn payments on, `false` to turn them off.
 * @returns The updated {@link DailyRoster}.
 * @throws Error whose message is a `funding.daily.*` catalog key. Maps
 * `Invalid payments switch` to `funding.daily.invalidSwitch`.
 */
export async function saveDailyRosterPayments(
  session: string,
  enabled: boolean,
): Promise<DailyRoster> {
  return postDailyRoster('/funding/daily-roster/payments', session, { enabled });
}

/**
 * Adds a recipient to the daily payout roster.
 *
 * Hits same-origin `POST /funding/daily-roster/recipients` with
 * `{ accountId, amountUsd }`.
 *
 * @param session - Bearer session.
 * @param accountId - Member account id.
 * @param amountUsd - Daily amount in USD.
 * @returns The updated {@link DailyRoster}.
 * @throws Error whose message is a `funding.daily.*` catalog key. Maps
 * `Invalid person or amount`, `Unknown person`, `Person has no Lightning address`,
 * and `Address already listed`.
 */
export async function addDailyRosterRecipient(
  session: string,
  accountId: string,
  amountUsd: number,
): Promise<DailyRoster> {
  return postDailyRoster('/funding/daily-roster/recipients', session, { accountId, amountUsd });
}

/**
 * Updates one daily-payout recipient amount.
 *
 * Hits same-origin `POST /funding/daily-roster/recipients/update` with
 * `{ address, amountUsd }`.
 *
 * @param session - Bearer session.
 * @param address - Recipient address already on the list.
 * @param amountUsd - New daily amount in USD.
 * @returns The updated {@link DailyRoster}.
 * @throws Error whose message is a `funding.daily.*` catalog key. Maps
 * `Invalid address or amount` and `Unknown address`.
 */
export async function updateDailyRosterRecipient(
  session: string,
  address: string,
  amountUsd: number,
): Promise<DailyRoster> {
  return postDailyRoster('/funding/daily-roster/recipients/update', session, {
    address,
    amountUsd,
  });
}

/**
 * Removes a recipient from the daily payout roster.
 *
 * Hits same-origin `POST /funding/daily-roster/recipients/delete` with
 * `{ address }`.
 *
 * @param session - Bearer session.
 * @param address - Recipient address to remove.
 * @returns The updated {@link DailyRoster}.
 * @throws Error whose message is a `funding.daily.*` catalog key. Maps
 * `Unknown address`.
 */
export async function deleteDailyRosterRecipient(
  session: string,
  address: string,
): Promise<DailyRoster> {
  return postDailyRoster('/funding/daily-roster/recipients/delete', session, { address });
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

/** 401 from the public active page. A later page sends the visitor to log in. */
export class PublicForumUnauthorizedError extends Error {
  constructor() {
    super('Could not load messages. Please try again.');
    this.name = 'PublicForumUnauthorizedError';
  }
}

/**
 * Active living-room page with no Authorization header.
 *
 * @param args - Page size (default 20) and optional cursor.
 * @returns The validated page.
 * @throws PublicForumUnauthorizedError on HTTP 401.
 * @throws Error when the api is unavailable or the body fails {@link forumListSchema}.
 */
export async function fetchPublicForumMessages(
  args: { limit?: number; cursor?: string | null } = {},
): Promise<ForumFeedPage> {
  const query = new URLSearchParams();
  query.set('mode', 'active');
  query.set('limit', String(args.limit ?? 20));
  if (args.cursor !== undefined && args.cursor !== null && args.cursor !== '') {
    query.set('cursor', args.cursor);
  }
  let response: Response;
  try {
    response = await fetch(`/forum/messages?${query.toString()}`);
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
  if (response.status === 401) {
    throw new PublicForumUnauthorizedError();
  }
  if (!response.ok) {
    throw new Error('Could not load messages. Please try again.');
  }
  try {
    const page = forumListSchema.parse(await response.json());
    return { messages: page.messages, nextCursor: page.nextCursor ?? null };
  } catch {
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

const PLACES_LOAD_ERROR = 'Could not load places. Please try again.';

/**
 * Fetches forum place pins for the signed-in session.
 *
 * Hits same-origin `GET /forum/messages/places` (Bearer).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns Place rows from {@link forumPlacesResponseSchema}.
 * @throws Error with visitor-facing copy on a non-2xx status, a network
 * failure, or a body that fails {@link forumPlacesResponseSchema}.
 */
export async function fetchPlaces(sessionToken: string): Promise<ForumPlaceRow[]> {
  try {
    const response = await fetch('/forum/messages/places', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error(PLACES_LOAD_ERROR);
    }
    return forumPlacesResponseSchema.parse(await response.json()).places;
  } catch {
    throw new Error(PLACES_LOAD_ERROR);
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
 * Optional `sinceReceivedSats` waits until a reply has more received sats.
 *
 * @param id - Forum message UUID.
 * @param opts - Optional `sinceSats` / `sinceReceivedSats` query and
 * `AbortSignal` for the fetch.
 * @returns The {@link ForumMessage}, or `null` when the id is unknown (404) or
 * the request was aborted.
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchPublicMessage(
  id: string,
  opts?: { sinceSats?: number; sinceReceivedSats?: number; signal?: AbortSignal },
): Promise<ForumMessage | null> {
  try {
    const sinceSats = opts?.sinceSats;
    const sinceReceivedSats = opts?.sinceReceivedSats;
    const path = `/public-messages/${encodeURIComponent(id)}`;
    const query: string[] = [];
    if (sinceSats !== undefined && Number.isInteger(sinceSats) && sinceSats >= 0) {
      query.push(`sinceSats=${sinceSats}`);
    }
    if (
      sinceReceivedSats !== undefined &&
      Number.isInteger(sinceReceivedSats) &&
      sinceReceivedSats >= 0
    ) {
      query.push(`sinceReceivedSats=${sinceReceivedSats}`);
    }
    const url = query.length === 0 ? path : `${path}?${query.join('&')}`;
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
 * Fetches the public Nostr profile for an external forum author.
 *
 * HTTP 404, other non-OK responses, network failures, JSON failures, and
 * schema mismatch return `null`.
 *
 * @param id - Forum message UUID.
 * @returns The {@link ExternalAuthorProfile}, or `null`.
 * @throws Does not throw.
 */
export async function fetchExternalAuthorProfile(
  id: string,
): Promise<ExternalAuthorProfile | null> {
  try {
    const response = await fetch(`/public-messages/${encodeURIComponent(id)}/external-profile`);
    if (!response.ok) {
      return null;
    }
    const parsed = externalAuthorProfileSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

const EXTERNAL_AUTHOR_FEED_ERROR = 'Could not load messages. Please try again.';

/**
 * GET `{ messages }` for an external author's public posts or replies.
 *
 * @param id - Forum message UUID.
 * @param kind - Path segment after the id.
 * @returns Items that pass {@link forumMessageSchema}; invalid items skipped.
 * @throws Visitor copy on non-OK, network, non-JSON, or a body that is not
 * `{ messages: array }`.
 */
async function fetchExternalAuthorFeed(
  id: string,
  kind: 'external-posts' | 'external-replies',
): Promise<ForumMessage[]> {
  try {
    const response = await fetch(`/public-messages/${encodeURIComponent(id)}/${kind}`);
    if (!response.ok) {
      throw new Error(EXTERNAL_AUTHOR_FEED_ERROR);
    }
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('messages' in body) ||
      !Array.isArray(body.messages)
    ) {
      throw new Error(EXTERNAL_AUTHOR_FEED_ERROR);
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
    throw new Error(EXTERNAL_AUTHOR_FEED_ERROR);
  }
}

/**
 * Fetches this external author's public posts without a session.
 *
 * Items that fail {@link forumMessageSchema} are skipped; none surviving
 * returns `[]`. HTTP 200 with an empty list returns `[]`. HTTP 404 is an
 * error (not empty). Does not send Authorization.
 *
 * @param id - Forum message UUID.
 * @returns Post list.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * id is unknown (404), the body is not JSON, or the body is not
 * `{ messages: array }`.
 */
export async function fetchExternalAuthorPosts(id: string): Promise<ForumMessage[]> {
  return fetchExternalAuthorFeed(id, 'external-posts');
}

/**
 * Fetches this external author's public replies without a session.
 *
 * Items that fail {@link forumMessageSchema} are skipped; none surviving
 * returns `[]`. HTTP 200 with an empty list returns `[]`. HTTP 404 is an
 * error (not empty). Does not send Authorization.
 *
 * @param id - Forum message UUID.
 * @returns Reply list.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * id is unknown (404), the body is not JSON, or the body is not
 * `{ messages: array }`.
 */
export async function fetchExternalAuthorReplies(id: string): Promise<ForumMessage[]> {
  return fetchExternalAuthorFeed(id, 'external-replies');
}

/**
 * Resolves a public short code (`/l/<8 hex>`) to a message or member id.
 *
 * Invalid codes, non-OK responses, and unexpected bodies return `null`.
 * Network and JSON failures return `null` and do not throw.
 *
 * @param code - Eight hex characters (case-insensitive).
 * @returns The kind and lowercased id, or `null`.
 * @throws Does not throw.
 */
export async function fetchShortLink(
  code: string,
): Promise<{ kind: 'message' | 'member'; id: string } | null> {
  if (!/^[0-9a-f]{8}$/i.test(code)) {
    return null;
  }
  try {
    const response = await fetch(`/links/${encodeURIComponent(code)}`);
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    const path = shortLinkPath(body);
    if (path === null) {
      return null;
    }
    const kind = path.startsWith('/messages/') ? 'message' : 'member';
    const id = path.slice(path.lastIndexOf('/') + 1);
    return { kind, id };
  } catch {
    return null;
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

type ForumPostStill = {
  contentType: string;
  data: string;
  takenAt?: string | null;
};

/**
 * Ask fields for a top-level note. Both must be present; replies omit them.
 * `goalAmount` is the trimmed draft (a comma stays a comma).
 * `goalRepayable` is sent only when it is `true` and the ask fields are sent.
 *
 * @param inReplyTo - Parent id when posting a reply.
 * @param goalCurrency - Typed Ask unit, or omitted.
 * @param goalAmount - Typed Ask amount, or omitted.
 * @param goalRepayable - Credit Ask flag, or omitted for a donation.
 * @returns Both fields (and `goalRepayable` when true), or `null` when they must not be sent.
 */
function forumAskGoalFields(
  inReplyTo: string | undefined,
  goalCurrency: ForumGoalCurrency | undefined,
  goalAmount: string | undefined,
  goalRepayable?: true,
  goalTermDays?: number,
): {
  goalCurrency: ForumGoalCurrency;
  goalAmount: string;
  goalRepayable?: true;
  goalTermDays?: number;
} | null {
  if (inReplyTo !== undefined) {
    return null;
  }
  if (goalCurrency === undefined || goalAmount === undefined) {
    return null;
  }
  const amount = goalAmount.trim();
  if (amount === '') {
    return null;
  }
  return {
    goalCurrency,
    goalAmount: amount,
    ...(goalRepayable === true ? { goalRepayable: true as const } : {}),
    ...(goalRepayable === true && typeof goalTermDays === 'number' ? { goalTermDays } : {}),
  };
}

/**
 * Posts a new public forum message (text and/or up to ten photos), or a reply.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param input - Trimmed text, optional legacy `photo`, optional `photos`,
 * optional `inReplyTo` parent id (thread composer only; omit for top-level
 * notes), optional `goalCurrency` plus `goalAmount` (top-level Ask; omitted
 * on replies and when either is unset; never `goalSats`), optional
 * `goalRepayable: true` on a credit Ask (omitted on a donation), and optional
 * `place` pin (omit when unset; replies must not send it), and optional
 * `shopUsername` (omit when unset; a leading `@` is stripped).
 * @returns The created {@link ForumMessage}.
 * @throws {@link NoteDeletedError} on 404 unless the api error is exactly
 * `No account with that username`.
 * @throws Error when the api rejects the body (400, 403, or 429), or on 404
 * whose error is exactly `No account with that username` — the api
 * error string when present, otherwise a fallback — {@link MissingRequirementsError}
 * on 409, on any other non-2xx status, or when the body fails
 * {@link forumMessageSchema} validation.
 */
export async function postMessage(
  sessionToken: string,
  input: {
    text: string;
    photo?: ForumPostStill;
    photos?: ForumPostStill[];
    inReplyTo?: string;
    goalCurrency?: ForumGoalCurrency;
    goalAmount?: string;
    goalRepayable?: true;
    goalTermDays?: number;
    place?: ForumPlacePin;
    shopUsername?: string;
  },
): Promise<ForumMessage> {
  const sourceStills =
    input.photos !== undefined
      ? input.photos.slice(0, 10)
      : input.photo !== undefined
        ? [input.photo]
        : [];
  const stills = sourceStills.map((still) => ({
    contentType: still.contentType,
    data: still.data,
    ...(typeof still.takenAt === 'string' && still.takenAt.trim() !== ''
      ? { takenAt: still.takenAt }
      : {}),
  }));
  const inReplyTo =
    input.inReplyTo !== undefined && input.inReplyTo !== '' ? input.inReplyTo : undefined;
  const askGoal = forumAskGoalFields(
    inReplyTo,
    input.goalCurrency,
    input.goalAmount,
    input.goalRepayable,
    input.goalTermDays,
  );
  const shopUsername = input.shopUsername?.trim().replace(/^@/, '') ?? '';
  const response = await fetch('/forum/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({
      text: input.text,
      ...(stills.length === 0 ? {} : { photo: stills[0], photos: stills }),
      ...(inReplyTo !== undefined ? { inReplyTo } : {}),
      ...(askGoal === null ? {} : askGoal),
      ...(inReplyTo === undefined && input.place !== undefined ? { place: input.place } : {}),
      ...(shopUsername === '' ? {} : { shopUsername }),
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
  if (response.status === 404) {
    const raw = await readApiError(response);
    if (raw === 'No account with that username') {
      throw new Error(toUserFacingError(raw));
    }
    throw new NoteDeletedError();
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
 * @param input - Text, video file, optional JPEG poster, optional
 * `goalCurrency` plus `goalAmount` (omitted from the form when either is
 * unset; never `goalSats`), optional `goalRepayable: true` on a credit Ask,
 * and optional `place` pin (omit when unset; form fields only when set),
 * and optional `shopUsername` (omit when unset; a leading `@` is stripped).
 * @returns The created {@link ForumMessage}.
 * @throws Error when the api rejects the body (400, 404, or 429) — the api error
 * string when present, otherwise a fallback — on any other non-2xx status, or
 * when the body fails {@link forumMessageSchema} validation.
 */
export async function postMessageVideo(
  sessionToken: string,
  input: {
    text: string;
    video: File;
    poster?: Blob;
    goalCurrency?: ForumGoalCurrency;
    goalAmount?: string;
    goalRepayable?: true;
    goalTermDays?: number;
    place?: ForumPlacePin;
    shopUsername?: string;
  },
): Promise<ForumMessage> {
  const form = new FormData();
  form.set('text', input.text);
  form.set('video', input.video);
  if (input.poster !== undefined) {
    form.set('poster', input.poster, 'poster.jpg');
  }
  const askGoal = forumAskGoalFields(
    undefined,
    input.goalCurrency,
    input.goalAmount,
    input.goalRepayable,
    input.goalTermDays,
  );
  if (askGoal !== null) {
    form.set('goalCurrency', askGoal.goalCurrency);
    form.set('goalAmount', askGoal.goalAmount);
    if (askGoal.goalRepayable === true) {
      form.set('goalRepayable', 'true');
    }
    if (typeof askGoal.goalTermDays === 'number') {
      form.set('goalTermDays', String(askGoal.goalTermDays));
    }
  }
  if (input.place !== undefined) {
    form.set('placeLat', String(input.place.lat));
    form.set('placeLng', String(input.place.lng));
    if (typeof input.place.label === 'string') {
      form.set('placeLabel', input.place.label);
    }
  }
  const shopUsername = input.shopUsername?.trim().replace(/^@/, '') ?? '';
  if (shopUsername !== '') {
    form.set('shopUsername', shopUsername);
  }
  const response = await fetch('/forum/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
    body: form,
  });
  if (response.status === 400 || response.status === 404 || response.status === 429) {
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
 * Loads the official platform profile note so a basis account can invoice
 * 1 sat to 21.gifts before posting or replying.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns `{ messageId, sats }` for `POST /messages/:id/invoice`.
 * @throws Error with collapsed visitor copy on non-2xx, or when the body is
 * not `{ messageId, sats }`.
 */
export async function fetchComposeTarget(
  sessionToken: string,
): Promise<{ messageId: string; sats: number }> {
  const response = await fetch('/messages/compose-target', {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    const raw = await readApiError(response);
    throw new Error(raw === null ? 'Could not start the Bitcoin payment' : toUserFacingError(raw));
  }
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { messageId?: unknown }).messageId !== 'string' ||
    typeof (body as { sats?: unknown }).sats !== 'number'
  ) {
    throw new Error('Could not start the Bitcoin payment');
  }
  return {
    messageId: (body as { messageId: string }).messageId,
    sats: (body as { sats: number }).sats,
  };
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
 * @param shown - Fiat on screen for these sats. Stored with the payment and not recomputed.
 * @returns `{ pr, amountSats }` for QR / Wallet of Satoshi. The body may also carry
 *   `sparkInvoice`, which the in-app wallet pays instead of `pr`.
 * @throws {@link NoteDeletedError} on 404 (missing or deleted invoice target).
 * @throws Error with collapsed visitor copy on 400/429/503 (and other
 * non-2xx), {@link MissingRequirementsError} on 409, or when the body fails
 * {@link messageInvoiceSchema}.
 */
export async function postMessageInvoice(
  sessionToken: string,
  messageId: string,
  sats: number,
  text?: string,
  shown?: {
    amountUsd: string | null;
    amountChf: string | null;
    amountEur: string | null;
    amountPhp: string | null;
  },
): Promise<MessageInvoice> {
  const response = await fetch(`/messages/${encodeURIComponent(messageId)}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({
      sats,
      ...(text === undefined || text === '' ? {} : { text }),
      ...(shown === undefined ? {} : shown),
    }),
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
    throw new NoteDeletedError();
  }
  if (response.status === 503) {
    throw new Error('Could not start the Bitcoin payment');
  }
  if (!response.ok) {
    throw new Error('Could not start the Bitcoin payment');
  }
  return messageInvoiceSchema.parse(await response.json());
}

const repaymentLineSchema = z.object({
  dayIndex: z.number().int().nonnegative(),
  dueOn: z.string().nullable(),
  accountId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  amount: z.string().nullable(),
  sats: z.number().int().nonnegative().nullable(),
  status: z.enum(['scheduled', 'due', 'paid']),
  via: z.literal('lightning'),
});

const repaymentLedgerSchema = z.object({
  currency: z.enum(['BTC', 'USD', 'CHF', 'EUR', 'PHP']),
  fundedAt: z.string().nullable(),
  termDays: z.number().int(),
  daysDue: z.number().int().nonnegative(),
  daysPaid: z.number().int().nonnegative(),
  unassignedSats: z.number().int().nonnegative(),
  givers: z.array(
    z.object({
      accountId: z.string(),
      name: z.string(),
      username: z.string().nullable(),
      givenSats: z.number().int().nonnegative(),
      givenAmount: z.string().nullable(),
    }),
  ),
  repayments: z.array(repaymentLineSchema),
  next: z
    .object({
      dayIndex: z.number().int().nonnegative(),
      sats: z.number().int().nonnegative(),
      recipientAccountId: z.string(),
    })
    .nullable(),
});

/** Public credit ledger from `GET /messages/:id/repayment`. */
export type RepaymentLedger = z.infer<typeof repaymentLedgerSchema>;

/** One row of {@link RepaymentLedger}. */
export type RepaymentLine = z.infer<typeof repaymentLineSchema>;

/**
 * Loads who gave what and the bitcoin repayment plan. No session.
 *
 * @param messageId - Credit note id.
 * @returns The ledger, or null when the note is not a credit or the body is unusable.
 */
export async function getRepayment(messageId: string): Promise<RepaymentLedger | null> {
  try {
    const response = await fetch(`/messages/${encodeURIComponent(messageId)}/repayment`);
    if (!response.ok) {
      return null;
    }
    return repaymentLedgerSchema.parse(await response.json());
  } catch {
    return null;
  }
}

/**
 * Asks for a BOLT11 that pays the next giver their share of the next due day.
 *
 * @param sessionToken - Bearer session of the credit's author.
 * @param messageId - Credit note id.
 * @returns The invoice the author pays from their wallet. The body may also
 *   carry `sparkInvoice`, which the in-app wallet pays instead of `pr`.
 * @throws Error with visitor copy when the api refuses.
 */
export async function postRepaymentInvoice(
  sessionToken: string,
  messageId: string,
): Promise<MessageInvoice> {
  const response = await fetch(`/messages/${encodeURIComponent(messageId)}/repayment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
  });
  if (response.status === 400 || response.status === 429 || response.status === 404) {
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
  if (response.status === 503 || !response.ok) {
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
      headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return conversationResponseSchema.parse(await response.json()).conversation;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/** Number of conversation messages requested per page. */
export const CONVERSATION_PAGE_LIMIT = 20;
/** How often an open conversation thread asks for newer messages while the tab is visible. */
export const CONVERSATION_LIVE_POLL_MS = 5_000;

/**
 * Fetches one page of messages in a private thread.
 *
 * The first request returns the newest page, ordered oldest-first within that
 * page. `nextCursor` is present only when the page is full; passing it back as
 * `cursor` loads the next older page. When `sinceMessageId` is a non-empty
 * string, the api long-polls until that id exists (or times out). `AbortError`
 * is rethrown so the inbox pay poll can treat cancel as a non-error.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @param opts - Optional older-page cursor, `sinceMessageId` query, and fetch signal.
 * @returns The page's oldest-first messages and its next older-page cursor.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * thread is missing, or the body fails {@link conversationThreadSchema}.
 * Re-throws `AbortError` when the request was aborted.
 */
export async function fetchConversation(
  sessionToken: string,
  id: string,
  opts?: { sinceMessageId?: string; cursor?: string; signal?: AbortSignal },
): Promise<{ messages: ConversationMessage[]; nextCursor: string | null }> {
  try {
    const query = new URLSearchParams({ limit: String(CONVERSATION_PAGE_LIMIT) });
    const cursor = opts?.cursor;
    const sinceMessageId = opts?.sinceMessageId;
    if (cursor !== undefined && cursor !== '') {
      query.set('cursor', cursor);
    }
    if (sinceMessageId !== undefined && sinceMessageId !== '') {
      query.set('sinceMessageId', sinceMessageId);
    }
    const url = `/conversations/${encodeURIComponent(id)}?${query.toString()}`;
    const init: RequestInit = {
      headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
    };
    if (opts?.signal !== undefined) {
      init.signal = opts.signal;
    }
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    const parsed = conversationThreadSchema.parse(await response.json());
    return { messages: parsed.messages, nextCursor: parsed.nextCursor ?? null };
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
 * @param shown - Fiat on screen for these sats. Stored with the payment and not recomputed.
 * @returns `{ pr, amountSats, messageId }` for QR / Wallet of Satoshi and poll. The
 *   body may also carry `sparkInvoice`, which the in-app wallet pays instead of `pr`.
 * @throws Error with collapsed visitor copy on 400/404/429/503 (and other
 * non-2xx), {@link MissingRequirementsError} on 409, or when the body fails
 * {@link conversationInvoiceSchema}.
 */
export async function postConversationInvoice(
  sessionToken: string,
  id: string,
  sats: number,
  text?: string,
  shown?: {
    amountUsd: string | null;
    amountChf: string | null;
    amountEur: string | null;
    amountPhp: string | null;
  },
): Promise<ConversationInvoice> {
  const response = await fetch(`/conversations/${encodeURIComponent(id)}/invoice`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sats,
      ...(text === undefined || text === '' ? {} : { text }),
      ...(shown === undefined ? {} : shown),
    }),
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
  photos?: { contentType: string; data: string; takenAt?: string | null }[],
): Promise<ConversationMessage> {
  const stills =
    photos !== undefined && photos.length > 0
      ? photos.slice(0, 10).map((still) => ({
          contentType: still.contentType,
          data: still.data,
          ...(typeof still.takenAt === 'string' && still.takenAt !== ''
            ? { takenAt: still.takenAt }
            : {}),
        }))
      : [];
  const response = await fetch(`/conversations/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
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
      headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
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
    const endpoint = await currentPushEndpoint();
    const headers: Record<string, string> = { Authorization: `Bearer ${sessionToken}` };
    const init: RequestInit = { method: 'POST', headers };
    if (typeof endpoint === 'string' && endpoint !== '') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify({ endpoint });
    }
    const response = await fetch(`/forum/notifications/${encodeURIComponent(id)}/read`, init);
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
    const endpoint = await currentPushEndpoint();
    const headers: Record<string, string> = { Authorization: `Bearer ${sessionToken}` };
    const init: RequestInit = { method: 'POST', headers };
    if (typeof endpoint === 'string' && endpoint !== '') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify({ endpoint });
    }
    const response = await fetch('/forum/notifications/read-all', init);
    if (!response.ok) {
      throw new Error('Could not mark notifications as read');
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return;
    }
    if (body !== null && typeof body === 'object' && 'tags' in body && Array.isArray(body.tags)) {
      const tags = body.tags.filter((tag): tag is string => typeof tag === 'string');
      await closeLocalPushNotifications(tags);
    }
  } catch {
    throw new Error('Could not mark notifications as read');
  }
}

/**
 * Marks every notification for one forum note as read.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param messageId - Forum message id (thread root or reply).
 * @returns `{ ok: true, tags }` from the api (`tags` defaults to `[]`).
 * @throws Error with visitor-facing copy when the api is unavailable — same
 * family as {@link markNotificationRead}.
 */
export async function markNotificationsReadForMessage(
  sessionToken: string,
  messageId: string,
): Promise<{ ok: true; tags: string[] }> {
  try {
    const endpoint = await currentPushEndpoint();
    const payload: { messageId: string; endpoint?: string } = { messageId };
    if (typeof endpoint === 'string' && endpoint !== '') {
      payload.endpoint = endpoint;
    }
    const response = await fetch('/forum/notifications/read-by-message', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Could not mark notification as read');
    }
    const body: unknown = await response.json();
    const tags =
      body !== null && typeof body === 'object' && 'tags' in body && Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
    await closeLocalPushNotifications(tags);
    return { ok: true, tags };
  } catch {
    throw new Error('Could not mark notification as read');
  }
}

/**
 * Marks the notification for one fully visible forum note as read.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param messageId - Forum message id (thread root or reply).
 * @returns `{ ok: true, tags }` from the api (`tags` defaults to `[]`).
 * @throws Error with visitor-facing copy when the api is unavailable — same
 * family as {@link markNotificationRead}.
 */
export async function markVisibleForumNoteRead(
  sessionToken: string,
  messageId: string,
): Promise<{ ok: true; tags: string[] }> {
  try {
    const endpoint = await currentPushEndpoint();
    const payload: { messageId: string; endpoint?: string } = { messageId };
    if (typeof endpoint === 'string' && endpoint !== '') {
      payload.endpoint = endpoint;
    }
    const response = await fetch('/forum/notifications/read-visible', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Could not mark notification as read');
    }
    const body: unknown = await response.json();
    const tags =
      body !== null && typeof body === 'object' && 'tags' in body && Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
    await closeLocalPushNotifications(tags);
    return { ok: true, tags };
  } catch {
    throw new Error('Could not mark notification as read');
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
 * When set (non-empty), POSTs JSON `{ viewKey }` and ignores `name`.
 * @param name - Optional already-normalized username for a new account. Used only
 * when `viewKey` is absent or empty: a non-empty string POSTs JSON `{ name }`.
 * Otherwise POSTs with no body.
 * @returns Challenge id plus WebAuthn creation options JSON.
 * @throws Error with the api `{ error }` string when present on non-2xx, otherwise
 * a status fallback; or when the body fails validation.
 */
export async function startPasskeyRegistration(
  viewKey?: string,
  name?: string,
): Promise<PasskeyBegin> {
  const hasViewKey = viewKey !== undefined && viewKey !== '';
  const hasName = name !== undefined && name !== '';
  const response = hasViewKey
    ? await fetch('/auth/passkey/register/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewKey }),
      })
    : hasName
      ? await fetch('/auth/passkey/register/begin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
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
 * @throws Error `'Username is already in use'` on 409 with that exact api string.
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
  if (response.status === 409) {
    const raw = await readApiError(response);
    if (raw === 'Username is already in use') {
      throw new Error(raw);
    }
  }
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
 * @throws {@link UnknownCredentialError} on 400 with the unknown-credential api string.
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
  if (response.status === 400) {
    const raw = await readApiError(response);
    if (raw === UNKNOWN_CREDENTIAL_ERROR) {
      throw new UnknownCredentialError();
    }
  }
  if (!response.ok) {
    throw new Error(`Failed to finish passkey authentication: ${response.status}`);
  }
  return passkeySessionSchema.parse(await response.json());
}

/**
 * Starts a signed-in passkey seed ceremony (adds a recovery-phrase passkey).
 *
 * @param sessionToken - Bearer session.
 * @returns Challenge id plus WebAuthn creation options JSON.
 * @throws Error on a non-2xx status (including 409 when a seed already exists)
 * or a body that fails validation.
 */
export async function startPasskeySeed(sessionToken: string): Promise<PasskeyBegin> {
  const response = await fetch('/auth/passkey/seed/begin', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to start passkey seed: ${response.status}`);
  }
  return passkeyBeginSchema.parse(await response.json());
}

/**
 * Seed finish is not login. The body is the owner account, or that same
 * account under one `account` key when the body has no top-level `id`.
 * A further top-level field is not this form.
 *
 * @param body - Parsed JSON.
 * @returns The value to validate as an {@link Account}.
 */
function ownerAccountBody(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return body;
  }
  if ('id' in body) {
    return body;
  }
  if (Object.keys(body).length === 1 && Object.keys(body)[0] === 'account') {
    return (body as { account: unknown }).account;
  }
  return body;
}

/**
 * Completes passkey seed and returns the owner account. Does not mint a
 * new session; the existing Bearer stays valid. Does not show a recovery phrase.
 *
 * @param sessionToken - Bearer session.
 * @param challengeId - Id returned by {@link startPasskeySeed}.
 * @param credential - Browser attestation JSON.
 * @returns The owner {@link Account}.
 * @throws Error on a non-2xx status or a body that fails validation.
 */
export async function finishPasskeySeed(
  sessionToken: string,
  challengeId: string,
  credential: unknown,
): Promise<Account> {
  const response = await fetch('/auth/passkey/seed/finish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ challengeId, credential }),
  });
  if (!response.ok) {
    throw new Error(`Failed to finish passkey seed: ${response.status}`);
  }
  return accountSchema.parse(ownerAccountBody(await response.json()));
}

/**
 * Records that the signed-in member has seen their recovery phrase.
 *
 * @param sessionToken - Bearer session.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}.
 */
export async function postWalletBackupSeen(sessionToken: string): Promise<Account> {
  const response = await fetch('/me/wallet-backup-seen', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error('Could not save wallet backup');
  }
  return accountSchema.parse(await response.json());
}

/** Safe browser report body for `POST /me/passkey-renew/report`. */
export type PasskeyRenewReportBody = {
  stage: 'begin' | 'ceremony' | 'finish';
  outcome: 'failed' | 'cancelled';
  errorName: string;
  errorCode: string | null;
  httpStatus: number | null;
  message: string;
  /** `platform` or `cross-platform`. Omitted when unknown. */
  authenticatorAttachment?: 'platform' | 'cross-platform';
  /** Sorted allowlisted transports. Omitted when none. */
  transports?: string;
  /** 32 lowercase hex authenticator id. Omitted when unknown. */
  aaguid?: string;
  /** Browser `prf.enabled`. Omitted when unknown. */
  prfEnabled?: boolean;
  /** Whether PRF output was present. Omitted when unknown. */
  prfPresent?: boolean;
  /** Sorted allowlisted extension names. Omitted when none. */
  extensions?: string;
  /** WebAuthn flags byte, 0–255. Omitted when unknown. Zero is sent. */
  authenticatorFlags?: number;
  /** COSE public-key algorithm. Omitted when unknown. */
  publicKeyAlgorithm?: number;
  /** `credProps.rk`. Omitted when unknown. */
  residentKey?: boolean;
  /** hmac-secret supported. Omitted when unknown. */
  hmacSecret?: boolean;
  /** Allowlisted credProtect policy. Omitted when unknown. */
  credProtect?: string;
  /** Sorted browser capabilities that are true. Omitted when none. */
  clientCapabilities?: string;
};

/**
 * Reports a passkey-renew ceremony failure or cancel. Body is the six safe
 * fields plus optional public authenticator facts and browser capability
 * names. Never a phrase, PRF bytes, credential, challenge, or session.
 *
 * @param sessionToken - Bearer session.
 * @param body - Safe report fields.
 * @returns The owner {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}.
 */
export async function postPasskeyRenewReport(
  sessionToken: string,
  body: PasskeyRenewReportBody,
): Promise<Account> {
  const response = await fetch('/me/passkey-renew/report', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stage: body.stage,
      outcome: body.outcome,
      errorName: body.errorName,
      errorCode: body.errorCode,
      httpStatus: body.httpStatus,
      message: body.message,
      ...(body.authenticatorAttachment === undefined
        ? {}
        : { authenticatorAttachment: body.authenticatorAttachment }),
      ...(body.transports === undefined ? {} : { transports: body.transports }),
      ...(body.aaguid === undefined ? {} : { aaguid: body.aaguid }),
      ...(body.prfEnabled === undefined ? {} : { prfEnabled: body.prfEnabled }),
      ...(body.prfPresent === undefined ? {} : { prfPresent: body.prfPresent }),
      ...(body.extensions === undefined ? {} : { extensions: body.extensions }),
      ...(body.authenticatorFlags === undefined
        ? {}
        : { authenticatorFlags: body.authenticatorFlags }),
      ...(body.publicKeyAlgorithm === undefined
        ? {}
        : { publicKeyAlgorithm: body.publicKeyAlgorithm }),
      ...(body.residentKey === undefined ? {} : { residentKey: body.residentKey }),
      ...(body.hmacSecret === undefined ? {} : { hmacSecret: body.hmacSecret }),
      ...(body.credProtect === undefined ? {} : { credProtect: body.credProtect }),
      ...(body.clientCapabilities === undefined
        ? {}
        : { clientCapabilities: body.clientCapabilities }),
    }),
  });
  if (!response.ok) {
    throw new Error('Could not report passkey renew');
  }
  return accountSchema.parse(await response.json());
}

/**
 * Acknowledges the passkey-renew failure notice.
 *
 * @param sessionToken - Bearer session.
 * @returns The updated {@link Account}.
 * @throws Error on a non-2xx status or a body that fails {@link accountSchema}.
 */
export async function postPasskeyRenewAck(sessionToken: string): Promise<Account> {
  const response = await fetch('/me/passkey-renew/ack', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new Error('Could not acknowledge passkey renew');
  }
  return accountSchema.parse(await response.json());
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
    headers: { Authorization: `Bearer ${sessionToken}`, ...deviceTimeZoneHeader() },
  });
  if (response.status !== 204 && response.status !== 404) {
    throw new Error('Message deletion failed');
  }
}

/**
 * Sets or clears the place pin on a forum message (moderator session).
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum message UUID.
 * @param place - Pin to store, or `null` to clear.
 * @returns The updated {@link ForumMessage}. Cleared pins are omitted.
 * @throws Error on a non-2xx status (`Could not save place`) or a body that
 * fails {@link forumMessageSchema}.
 */
export async function setMessagePlace(
  sessionToken: string,
  messageId: string,
  place: ForumPlacePin | null,
): Promise<ForumMessage> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}/place`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({ place }),
  });
  if (!response.ok) {
    throw new Error('Could not save place');
  }
  return forumMessageSchema.parse(await response.json());
}

/**
 * Sets or clears the shop account on a forum message (moderator session).
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum message UUID.
 * @param username - 21.gifts username to attach, or `null` to clear.
 * @returns The updated {@link ForumMessage}. Cleared accounts are omitted.
 * @throws Error `No account with that username` on HTTP 404.
 * @throws Error `Could not save account` on any other non-2xx status or a body
 * that fails {@link forumMessageSchema}.
 */
export async function setMessageShopAccount(
  sessionToken: string,
  messageId: string,
  username: string | null,
): Promise<ForumMessage> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}/shop-account`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({ username }),
  });
  if (response.status === 404) {
    throw new Error('No account with that username');
  }
  if (!response.ok) {
    throw new Error('Could not save account');
  }
  return forumMessageSchema.parse(await response.json());
}

/**
 * Replaces the stills on a shop note (moderator session).
 *
 * An empty list clears stills. Video on the note is left in place.
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum message UUID.
 * @param photos - JPEG, PNG, or WebP stills, at most 10.
 * @returns The updated {@link ForumMessage}.
 * @throws Error `Could not save shop note` on a non-2xx status or a body that
 * fails {@link forumMessageSchema}.
 */
export async function setMessageShopPhotos(
  sessionToken: string,
  messageId: string,
  photos: { contentType: string; data: string; takenAt?: string | null }[],
): Promise<ForumMessage> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}/photos`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({
      photos: photos.map((photo) => ({
        contentType: photo.contentType,
        data: photo.data,
        ...(typeof photo.takenAt === 'string' && photo.takenAt !== ''
          ? { takenAt: photo.takenAt }
          : {}),
      })),
    }),
  });
  if (!response.ok) {
    throw new Error('Could not save shop note');
  }
  return forumMessageSchema.parse(await response.json());
}

/** One staff edit of a shop note, newest first when listed. */
export const shopNoteEditSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  field: z.enum(['text', 'place', 'shopAccount']),
  before: z.unknown(),
  after: z.unknown(),
  actor: z.object({
    id: z.string(),
    name: z.string().nullable(),
    role: z.string().nullable(),
  }),
});

/** Parsed `GET /forum/messages/:id/edits` row. */
export type ShopNoteEdit = z.infer<typeof shopNoteEditSchema>;

const shopNoteEditsSchema = z.object({ edits: z.array(shopNoteEditSchema) });

/**
 * Replaces the visible text of a shop note (moderator session).
 *
 * The stored body keeps `#21GiftsShop`. This sends the draft as typed.
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum message UUID.
 * @param text - New visible body. The shop tag may be omitted.
 * @returns The updated {@link ForumMessage}.
 * @throws Error `Could not save shop note` on a non-2xx status or a body that
 * fails {@link forumMessageSchema}.
 */
export async function setMessageShopText(
  sessionToken: string,
  messageId: string,
  text: string,
): Promise<ForumMessage> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}/text`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
      ...deviceTimeZoneHeader(),
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error('Could not save shop note');
  }
  return forumMessageSchema.parse(await response.json());
}

/**
 * Loads the staff edit history of one shop note.
 *
 * @param sessionToken - Bearer session.
 * @param messageId - Forum message UUID.
 * @returns Newest-first edits. An empty list means nobody has edited it.
 * @throws Error `Could not load edit history` on a non-2xx status or a body
 * that fails {@link shopNoteEditSchema}.
 */
export async function fetchShopNoteEdits(
  sessionToken: string,
  messageId: string,
): Promise<ShopNoteEdit[]> {
  const response = await fetch(`/forum/messages/${encodeURIComponent(messageId)}/edits`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...deviceTimeZoneHeader(),
    },
  });
  if (!response.ok) {
    throw new Error('Could not load edit history');
  }
  return shopNoteEditsSchema.parse(await response.json()).edits;
}

/**
 * Why the api refused a `/lnurl/…` request.
 *
 * - `notPayable`: malformed, not https, not a pay request, or on the app's own host.
 * - `notFound`: the receiver's server does not know the address.
 * - `unreachable`: the receiver's server did not answer the api.
 * - `amount`: the amount is outside the receiver's bounds.
 * - `comment`: the comment is longer than the receiver accepts.
 * - `failed`: any other status, a network error, or an unreadable body.
 */
export type LnurlRelayErrorReason =
  'notPayable' | 'notFound' | 'unreachable' | 'amount' | 'comment' | 'failed';

/** Exact api `{ error }` bodies of the `/lnurl/…` endpoints and their reasons. */
const LNURL_RELAY_ERRORS: Record<string, { status: number; reason: LnurlRelayErrorReason }> = {
  'Not a payable address': { status: 400, reason: 'notPayable' },
  'Address not found': { status: 404, reason: 'notFound' },
  'Address could not be reached': { status: 502, reason: 'unreachable' },
  'Amount out of range': { status: 400, reason: 'amount' },
  'Comment too long': { status: 400, reason: 'comment' },
};

/**
 * Rejection of `POST /lnurl/pay-request` or `POST /lnurl/invoice`.
 */
export class LnurlRelayError extends Error {
  /** Why the request was refused. */
  public readonly reason: LnurlRelayErrorReason;

  /**
   * @param reason - Why the request was refused.
   */
  public constructor(reason: LnurlRelayErrorReason) {
    super(`Lightning address request refused: ${reason}`);
    this.name = 'LnurlRelayError';
    this.reason = reason;
  }
}

/**
 * Posts one `/lnurl/…` request and maps a refusal to {@link LnurlRelayError}.
 *
 * @param path - Same-origin path.
 * @param sessionToken - Bearer session.
 * @param body - JSON body.
 * @returns The parsed JSON success body.
 * @throws {@link LnurlRelayError} on a network error or a non-2xx status.
 */
async function postLnurlRelay(path: string, sessionToken: string, body: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LnurlRelayError('failed');
  }
  if (!response.ok) {
    const raw = await readApiError(response);
    const known = raw === null ? undefined : LNURL_RELAY_ERRORS[raw];
    throw new LnurlRelayError(
      known !== undefined && known.status === response.status ? known.reason : 'failed',
    );
  }
  try {
    return await response.json();
  } catch {
    throw new LnurlRelayError('failed');
  }
}

/**
 * Reads the pay request of a Lightning address or LNURL on another host
 * through the api (`POST /lnurl/pay-request`), for its amount bounds and
 * comment length.
 *
 * @param sessionToken - Bearer session.
 * @param target - `user@domain` or a bech32 LNURL.
 * @returns The receiver's bounds, comment length, and normalised target.
 * @throws {@link LnurlRelayError} with `notPayable`, `notFound`, `unreachable`,
 * or `failed` (also when the body fails {@link lnurlPayRequestSchema}).
 */
export async function postLnurlPayRequest(
  sessionToken: string,
  target: string,
): Promise<LnurlPayRequest> {
  const parsed = lnurlPayRequestSchema.safeParse(
    await postLnurlRelay('/lnurl/pay-request', sessionToken, { target }),
  );
  if (!parsed.success) {
    throw new LnurlRelayError('failed');
  }
  return parsed.data;
}

/**
 * Asks the receiver of a Lightning address or LNURL on another host for an
 * invoice through the api (`POST /lnurl/invoice`). The api checks amount,
 * comment, and the returned invoice before it answers.
 *
 * @param sessionToken - Bearer session.
 * @param target - Normalised target from {@link postLnurlPayRequest}.
 * @param amountMsat - Amount in millisats.
 * @param comment - Optional comment; omitted when empty.
 * @returns `{ pr }`, the BOLT11 invoice to pay.
 * @throws {@link LnurlRelayError} with `notPayable`, `notFound`, `unreachable`,
 * `amount`, `comment`, or `failed` (also when the body fails {@link lnurlInvoiceSchema}).
 */
export async function postLnurlInvoice(
  sessionToken: string,
  target: string,
  amountMsat: number,
  comment?: string,
): Promise<LnurlInvoice> {
  const parsed = lnurlInvoiceSchema.safeParse(
    await postLnurlRelay('/lnurl/invoice', sessionToken, {
      target,
      amountMsat,
      ...(comment === undefined || comment === '' ? {} : { comment }),
    }),
  );
  if (!parsed.success) {
    throw new LnurlRelayError('failed');
  }
  return parsed.data;
}
