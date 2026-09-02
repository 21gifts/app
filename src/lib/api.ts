import { z } from 'zod';
import {
  accountSchema,
  contactSchema,
  conversationListSchema,
  conversationMessageSchema,
  conversationSchema,
  conversationThreadSchema,
  forumListSchema,
  forumMessageSchema,
  forumRepliesSchema,
  lnAddressResolvedSchema,
  giftDaySchema,
  giftStatsSchema,
  memberProfileSchema,
  messageInvoiceSchema,
  passkeyBeginSchema,
  passkeySessionSchema,
  pushSubscriptionResponseSchema,
  vapidPublicSchema,
  viewProfileSchema,
  type Account,
  type ContactMessage,
  type Conversation,
  type ConversationMessage,
  type ForumMessage,
  type GiftDay,
  type GiftStats,
  type LnAddressResolved,
  type MemberProfile,
  type MessageInvoice,
  type PasskeyBegin,
  type PasskeySession,
  type ViewProfile,
} from '@/lib/api-types';
import { MissingRequirementsError, parseMissingRequirements } from '@/lib/missing-requirements';

/**
 * Exact api 400 body when a Wallet of Satoshi address fails the NIP-57 zap probe.
 * Matched literally (English) before visitor-facing rewrite.
 */
export const LIGHTNING_ADDRESS_NOT_ZAP_ERROR =
  'This Wallet of Satoshi address cannot receive these Bitcoin payments';

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
 * Fetches every public top-level forum message (newest first).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @returns The message list.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link forumListSchema}.
 */
export async function fetchMessages(sessionToken: string): Promise<ForumMessage[]> {
  try {
    const response = await fetch('/forum/messages', {
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
 * Fetches one public forum message without a session (HTML note page).
 *
 * @param id - Forum message UUID.
 * @returns The {@link ForumMessage}, or `null` when the id is unknown (404).
 * @throws Error with visitor-facing copy on other failures or schema mismatch.
 */
export async function fetchPublicMessage(id: string): Promise<ForumMessage | null> {
  try {
    const response = await fetch(`/public-messages/${encodeURIComponent(id)}`);
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
 * Fetches replies for one forum note (oldest first).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Parent forum message UUID.
 * @returns Reply list (Damus authors may omit role; schema defaults to basis).
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * body fails {@link forumRepliesSchema}.
 */
export async function fetchReplies(sessionToken: string, id: string): Promise<ForumMessage[]> {
  try {
    const response = await fetch(`/forum/messages/${encodeURIComponent(id)}/replies`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return forumRepliesSchema.parse(await response.json()).messages;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Posts a new public forum message (text and/or one photo), or a reply.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param input - Trimmed text (may be empty when a photo is included), an
 * optional JPEG photo payload (`contentType` + raw base64 `data`), and optional
 * `inReplyTo` parent id (thread composer only; omit for top-level notes).
 * @returns The created {@link ForumMessage}.
 * @throws Error when the api rejects the body (400 or 429) — the api error
 * string when present, otherwise a fallback — on any other non-2xx status, or
 * when the body fails {@link forumMessageSchema} validation.
 */
export async function postMessage(
  sessionToken: string,
  input: {
    text: string;
    photo?: { contentType: string; data: string };
    inReplyTo?: string;
  },
): Promise<ForumMessage> {
  const response = await fetch('/forum/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      ...(input.photo ? { photo: input.photo } : {}),
      ...(input.inReplyTo !== undefined && input.inReplyTo !== ''
        ? { inReplyTo: input.inReplyTo }
        : {}),
    }),
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
 * official 21.gifts threads when the account is founder or moderator).
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
 * Fetches messages in one private thread (oldest first).
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @returns Message list.
 * @throws Error with visitor-facing copy when the api is unavailable, the
 * thread is missing, or the body fails {@link conversationThreadSchema}.
 */
export async function fetchConversation(
  sessionToken: string,
  id: string,
): Promise<ConversationMessage[]> {
  try {
    const response = await fetch(`/conversations/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!response.ok) {
      throw new Error('Could not load messages. Please try again.');
    }
    return conversationThreadSchema.parse(await response.json()).messages;
  } catch {
    throw new Error('Could not load messages. Please try again.');
  }
}

/**
 * Appends a private message to an existing thread.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Conversation UUID.
 * @param text - Message body as typed (api trims and validates length).
 * @returns The created {@link ConversationMessage}.
 * @throws Error when the api rejects the text (400) — the api error string
 * when present, otherwise a fallback — on any other non-2xx status, or when
 * the body fails {@link conversationMessageSchema} validation.
 */
export async function postConversationMessage(
  sessionToken: string,
  id: string,
  text: string,
): Promise<ConversationMessage> {
  const response = await fetch(`/conversations/${encodeURIComponent(id)}`, {
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
  if (!response.ok) {
    throw new Error('Could not send your message');
  }
  return conversationMessageSchema.parse(await response.json());
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
 * Fetches the JPEG/PNG/WebP bytes for one forum message photo.
 *
 * Auth is a Bearer token in JS memory, so callers must use the returned blob
 * (for example via `URL.createObjectURL`) instead of an `<img src>` to the
 * same-origin photo path.
 *
 * @param sessionToken - A bearer token from a completed challenge.
 * @param id - Forum message id.
 * @returns The photo body as a `Blob`.
 * @throws Error with visitor-facing copy when the api is unavailable or the
 * response is empty — same family as {@link fetchMessages}; does not leak status.
 */
export async function fetchMessagePhoto(sessionToken: string, id: string): Promise<Blob> {
  try {
    const response = await fetch(`/messages/${encodeURIComponent(id)}/photo`, {
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
 * Fetches a forum message photo without a session (public note page).
 *
 * Api `GET /messages/:id/photo` is public; the same-origin proxy forwards
 * without Authorization. Callers must use a blob URL, not a bare `<img src>`.
 *
 * @param id - Forum message id.
 * @returns The photo body as a `Blob`.
 * @throws Error with visitor-facing copy when the api is unavailable or empty.
 */
export async function fetchPublicMessagePhoto(id: string): Promise<Blob> {
  try {
    const response = await fetch(`/messages/${encodeURIComponent(id)}/photo`);
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
