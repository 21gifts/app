import { z } from 'zod';

/** Notification stages stored on the signed-in account. */
export const NOTIFICATION_LEVELS = ['all', 'active', 'mentions'] as const;

/** One of {@link NOTIFICATION_LEVELS}. */
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

/**
 * Runtime schema for an {@link Account} as returned by the api.
 *
 * Kept as the single source of truth: {@link Account} is inferred from it so
 * the compile-time type and the runtime validation can never drift apart.
 */
export const accountSchema = z.object({
  id: z.string(),
  linkingKey: z.string().nullable(),
  role: z.enum(['basis', 'verified', 'moderator', 'founder']),
  name: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  lightningAddress: z.string().nullable(),
  lightningAddressVerified: z.boolean(),
  forumLawsDismissed: z.boolean(),
  createdAt: z.number(),
  /** Epoch ms of the first living-room rules agreement, or `null` if not yet agreed. */
  rulesAgreedAt: z.number().nullable(),
  viewKey: z.string().regex(/^[0-9a-f]{64}$/),
  /** About me note, or `null` when unfilled (name-only auto notes). */
  aboutMe: z.string().nullable(),
  /** True when the live profile note has a photo. Optional so older api bodies still parse. */
  aboutMeHasPhoto: z.boolean().optional().default(false),
  /** Next onboarding step from the api, or `null` when onboarding is done. */
  setup: z.enum(['name', 'lightning-address', 'rules']).nullable(),
  /** Fields still missing for posts (may include skipped onboarding steps). */
  missing: z.array(z.enum(['name', 'lightning-address', 'rules'])),
  /**
   * True after the owner has posted at least one forum note. Optional so current
   * develop api bodies still parse; the introduce overlay only opens when this
   * is strictly `false`.
   */
  hasPosted: z.boolean().optional(),
  /**
   * In-app and Web Push filter. Optional so current develop api bodies still
   * parse; missing means {@link accountNotificationLevel} returns `all`.
   */
  notificationLevel: z.enum(['all', 'active', 'mentions']).optional(),
});

/**
 * An authenticated 21.gifts account.
 *
 * `role` is the live membership tier (`basis`, `verified`, `moderator`, or
 * `founder`); `linkingKey` is a leftover wallet public key from the retired
 * LNURL-auth login, or `null` for passkey-created accounts.
 * `name` is the non-empty display name, or `null` until the giver sets one.
 * `location` is an optional free-text place (never `""`; empty clears to `null`).
 * `lightningAddress` is the receiver's `name@domain.tld` address, or `null` when
 * none is linked. `lightningAddressVerified` is accepted from the api (proof-of-
 * control flag) but unused in the UI — live verification payments are not
 * configured on the api. `forumLawsDismissed` is true after the user dismissed
 * the welcome-forum living-room laws hint; false for new accounts and until
 * they click the X. Forum role tags use `role`, not this flag.
 * `rulesAgreedAt` is the epoch ms of the first agreement to the living-room
 * rules, or `null` until the giver agrees. `viewKey` is a 64-character
 * lowercase hex capability key for the public read-only profile URL
 * `/view/<viewKey>` (owner `/me` only; never shown on the public view payload;
 * never rendered as visible text in the signed-in profile UI).
 * `aboutMe` is the profile card note, or `null` until the giver writes one
 * (name-only auto notes from the api are `null`).
 * `aboutMeHasPhoto` is true when the live profile note has a photo (optional
 * on older api bodies; defaults to false).
 * `setup` is the next onboarding screen (`name`, `lightning-address`, `rules`)
 * or `null` when onboarding is complete (including after skips). `missing` lists
 * fields still unset for posting; skipped steps stay listed until filled.
 * `hasPosted` is true after the owner has posted in the forum, false until then,
 * and omitted on older api builds (the introduce overlay fails open when the
 * field is missing).
 * `notificationLevel` is `all` (every living-room post, reply, and gift),
 * `active` (posts with gifts), or `mentions` (admin/staff posts and events
 * that involve the owner). Omitted on older api builds; treat as `all`.
 */
export type Account = z.infer<typeof accountSchema>;

/**
 * Notification stage stored on an account, defaulting to `all` when omitted.
 *
 * @param account - Parsed {@link Account} (field may be missing).
 * @returns `all`, `active`, or `mentions`.
 */
export function accountNotificationLevel(account: Account): NotificationLevel {
  return account.notificationLevel ?? 'all';
}

/**
 * Runtime schema for a public read-only profile from `GET /view/:viewKey`.
 *
 * `hasPasskey` is true when the profile already has a registered passkey
 * (invite claim is then unnecessary).
 */
export const viewProfileSchema = z.object({
  name: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  lightningAddress: z.string().nullable(),
  lightningAddressVerified: z.boolean(),
  createdAt: z.number(),
  hasPasskey: z.boolean(),
  /** About me note, or `null` when unfilled. */
  aboutMe: z.string().nullable(),
  /** True when the live profile note has a photo. Optional so older api bodies still parse. */
  aboutMeHasPhoto: z.boolean().optional().default(false),
});

/**
 * Public profile fields returned by the view-key endpoint (no id, linkingKey, role, or viewKey).
 * `aboutMeHasPhoto` is true when the live profile note has a photo.
 */
export type ViewProfile = z.infer<typeof viewProfileSchema>;

/**
 * Runtime schema for the payload of `GET /lightning-address`.
 *
 * `callback` is the LNURL-pay URL the browser uses to fetch an invoice.
 * `minSendable` / `maxSendable` are millisatoshis. `commentAllowed` is
 * omitted when the provider does not accept a LUD-12 comment.
 */
export const lnAddressResolvedSchema = z.object({
  address: z.string(),
  callback: z.string().url(),
  minSendable: z.number().int().nonnegative(),
  maxSendable: z.number().int().nonnegative(),
  commentAllowed: z.number().int().optional(),
});

/**
 * Cached LUD-16 metadata from the api, used to fetch a gift invoice in the
 * browser.
 */
export type LnAddressResolved = z.infer<typeof lnAddressResolvedSchema>;

/** BTC amount string from the api: whole sats as BTC with exactly 8 decimals. */
export const btcAmountStringSchema = z.string().regex(/^\d+\.\d{8}$/);

/** USD amount string from the api: exactly 2 decimals. */
export const usdAmountStringSchema = z.string().regex(/^\d+\.\d{2}$/);

/** Fiat amount string from the api: two decimals, or `null` when that currency could not be summed. */
export const fiatAmountSchema = usdAmountStringSchema.nullable();

/**
 * FX provenance for gift-day BTC-USD closes plus CHF/EUR/PHP quotes on
 * `GET /gifts/stats` and `GET /gifts?day=`.
 */
export const giftStatsFxSchema = z.object({
  quote: z.literal('BTC-USD'),
  dayBasis: z.literal('utc'),
  source: z.literal('coinbase-exchange-daily-close'),
  quotes: z.array(
    z.object({
      code: z.enum(['USD', 'CHF', 'EUR', 'PHP']),
      pair: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
});

/**
 * One UTC day in the cumulative spend series from `GET /gifts/stats`.
 */
export const spendDaySchema = z.object({
  day: z.string(),
  sats: z.number().int().nonnegative(),
  cumulativeSats: z.number().int().nonnegative(),
  btc: btcAmountStringSchema,
  cumulativeBtc: btcAmountStringSchema,
  usd: usdAmountStringSchema,
  cumulativeUsd: usdAmountStringSchema,
  chf: fiatAmountSchema,
  eur: fiatAmountSchema,
  php: fiatAmountSchema,
  cumulativeChf: fiatAmountSchema,
  cumulativeEur: fiatAmountSchema,
  cumulativePhp: fiatAmountSchema,
});

/**
 * Per-recipient totals from `GET /gifts/stats`.
 */
export const recipientSpendSchema = z.object({
  recipient: z.string(),
  giftCount: z.number().int().nonnegative(),
  sats: z.number().int().nonnegative(),
  btc: btcAmountStringSchema,
  usd: usdAmountStringSchema,
  chf: fiatAmountSchema,
  eur: fiatAmountSchema,
  php: fiatAmountSchema,
});

/**
 * Per-month totals from `GET /gifts/stats`.
 */
export const monthSpendSchema = z.object({
  month: z.string(),
  giftCount: z.number().int().nonnegative(),
  sats: z.number().int().nonnegative(),
  btc: btcAmountStringSchema,
  usd: usdAmountStringSchema,
  chf: fiatAmountSchema,
  eur: fiatAmountSchema,
  php: fiatAmountSchema,
});

/**
 * Runtime schema for the payload of `GET /gifts/stats`.
 */
export const giftStatsSchema = z.object({
  totalSats: z.number().int().nonnegative(),
  totalBtc: btcAmountStringSchema,
  totalUsd: usdAmountStringSchema,
  totalChf: fiatAmountSchema,
  totalEur: fiatAmountSchema,
  totalPhp: fiatAmountSchema,
  giftCount: z.number().int().nonnegative(),
  recipientCount: z.number().int().nonnegative(),
  firstPaidAt: z.string().nullable(),
  lastPaidAt: z.string().nullable(),
  spendOverTime: z.array(spendDaySchema),
  byRecipient: z.array(recipientSpendSchema),
  byMonth: z.array(monthSpendSchema),
  fx: giftStatsFxSchema,
});

/**
 * Aggregated outbound gift statistics from the api.
 */
export type GiftStats = z.infer<typeof giftStatsSchema>;

/**
 * FX on account activity. `quotes` is optional so payloads from an api that
 * has not yet shipped gift-stats fiat currencies still parse.
 */
export const activityFxSchema = giftStatsFxSchema.extend({
  quotes: giftStatsFxSchema.shape.quotes.optional(),
});

/**
 * One UTC day on an activity series. Fiat columns are optional for the same
 * reason as {@link activityFxSchema}.
 */
export const activitySpendDaySchema = spendDaySchema.partial({
  chf: true,
  eur: true,
  php: true,
  cumulativeChf: true,
  cumulativeEur: true,
  cumulativePhp: true,
});

/**
 * Runtime schema for signed-in, member, and public-view activity
 * (`GET /me/activity`, `GET /members/:id/activity`, `GET /view/:viewKey/activity`).
 *
 * Series share the gift-stats day shape, with optional fiat fields. Totals
 * include house gifts and forum zaps.
 */
export const accountActivitySchema = z.object({
  donatedSats: z.number().int().nonnegative(),
  receivedSats: z.number().int().nonnegative(),
  donatedOverTime: z.array(activitySpendDaySchema),
  receivedOverTime: z.array(activitySpendDaySchema),
  fx: activityFxSchema,
});

/**
 * Given and received sat totals plus cumulative series for one account.
 */
export type AccountActivity = z.infer<typeof accountActivitySchema>;

/**
 * One outbound gift in `GET /gifts?day=`.
 */
export const giftDayGiftSchema = z.object({
  paidAt: z.string(),
  amountSats: z.number().int().nonnegative(),
  amountBtc: btcAmountStringSchema,
  amountUsd: usdAmountStringSchema,
  amountChf: fiatAmountSchema,
  amountEur: fiatAmountSchema,
  amountPhp: fiatAmountSchema,
  recipient: z.string(),
});

/**
 * Runtime schema for the payload of `GET /gifts?day=YYYY-MM-DD`.
 */
export const giftDaySchema = z.object({
  day: z.string(),
  giftCount: z.number().int().nonnegative(),
  totalSats: z.number().int().nonnegative(),
  totalBtc: btcAmountStringSchema,
  totalUsd: usdAmountStringSchema,
  totalChf: fiatAmountSchema,
  totalEur: fiatAmountSchema,
  totalPhp: fiatAmountSchema,
  gifts: z.array(giftDayGiftSchema),
  fx: giftStatsFxSchema,
});

/**
 * Outbound gifts for one UTC day from the api.
 */
export type GiftDay = z.infer<typeof giftDaySchema>;

/**
 * One gift in a per-day list.
 */
export type GiftDayGift = z.infer<typeof giftDayGiftSchema>;

/**
 * Runtime schema for passkey begin (`register` or `authenticate`).
 *
 * `options` is the WebAuthn JSON options object (challenge, rp, user, …).
 */
export const passkeyBeginSchema = z.object({
  challengeId: z.string(),
  options: z.record(z.unknown()),
});

/**
 * A freshly minted passkey ceremony (register or authenticate).
 */
export type PasskeyBegin = z.infer<typeof passkeyBeginSchema>;

/**
 * Runtime schema for passkey finish: session token plus account.
 */
export const passkeySessionSchema = z.object({
  token: z.string(),
  account: accountSchema,
});

/**
 * A session issued immediately after a successful passkey ceremony.
 */
export type PasskeySession = z.infer<typeof passkeySessionSchema>;

/**
 * Trimmed forum body length accepted by `POST /messages` (api `MESSAGE_MAX_LENGTH`).
 */
export const FORUM_MESSAGE_MAX_LENGTH = 500;

/**
 * Runtime schema for one public forum message from `GET`/`POST /messages`.
 *
 * `sats` is the validated payment total for the note (always present, including 0).
 * `payable` is true when a signed-in member can request an invoice for that note.
 * `photoCount` defaults from `hasPhoto` when an older api omits it.
 * `hasVideo` / `videoContentType` default when an older api omits them.
 * `role` is optional with default `basis` so a rolling api deploy without the
 * field still parses and the board stays lit.
 * `replyCount` defaults to 0 so mixed deploys without the field still parse.
 * `accountId` is the author's account id when the api includes it; omitted on mixed/old payloads.
 * `via` is present only on replies from a Nostr user with no 21.gifts account; any other `via` value fails the parse.
 * `parentId` is the parent note id on a reply; omitted on top-level notes.
 * Gift-only replies may have empty `text` when `sats > 0`.
 */
export const forumMessageSchema = z
  .object({
    id: z.string().min(1),
    accountId: z.string().min(1).optional(),
    parentId: z.string().min(1).optional(),
    name: z.string().min(1),
    text: z.string(), // may be '' when hasPhoto, hasVideo, or sats > 0
    createdAt: z.string().datetime({ offset: true }),
    sats: z.number().int().nonnegative(),
    payable: z.boolean(),
    hasPhoto: z.boolean(),
    photoCount: z.number().int().min(0).max(10).optional(),
    hasVideo: z.boolean().optional().default(false),
    videoContentType: z
      .enum(['video/mp4', 'video/webm', 'video/quicktime'])
      .nullable()
      .optional()
      .default(null),
    role: z.enum(['basis', 'verified', 'moderator', 'founder']).optional().default('basis'),
    replyCount: z.number().int().nonnegative().default(0),
    via: z.literal('nostr').optional(),
  })
  .refine(
    (message) => message.text !== '' || message.hasPhoto || message.hasVideo || message.sats > 0,
  )
  .transform((message) => ({
    ...message,
    photoCount: message.photoCount ?? (message.hasPhoto ? 1 : 0),
  }));

/**
 * Runtime schema for the payload of `GET /messages` (top-level notes).
 */
export const forumListSchema = z.object({
  messages: z.array(forumMessageSchema),
});

/**
 * Runtime schema for one hidden forum note from `GET /messages/hidden`.
 *
 * `text` and author `name` may be empty. `parentId` is null on a top-level
 * note. `hasVideo` / `videoContentType` default when an older api omits them.
 * `deletedBy.id`, `deletedBy.name`, and `deletedBy.role` may be null when the
 * deleter row is missing.
 * `via` is any non-empty string marking a row written without a 21.gifts
 * account (today the api sends `'nostr'`); only an empty string fails the parse.
 */
export const hiddenMessageSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  text: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  sats: z.number().int().nonnegative(),
  hasPhoto: z.boolean(),
  hasVideo: z.boolean().optional().default(false),
  videoContentType: z
    .enum(['video/mp4', 'video/webm', 'video/quicktime'])
    .nullable()
    .optional()
    .default(null),
  parentId: z.string().min(1).nullable(),
  deletedAt: z.string().datetime({ offset: true }),
  deletedBy: z.object({
    id: z.string().min(1).nullable(),
    name: z.string().min(1).nullable(),
    role: z.enum(['basis', 'verified', 'moderator', 'founder']).nullable(),
  }),
  via: z.string().min(1).optional(),
});

/**
 * Runtime schema for the payload of `GET /messages/hidden`.
 */
export const hiddenListSchema = z.object({
  messages: z.array(hiddenMessageSchema),
});

/**
 * One hidden forum note from the api.
 */
export type HiddenMessage = z.infer<typeof hiddenMessageSchema>;

/**
 * Runtime schema for `GET /messages/:id/replies` (oldest-first).
 */
export const forumRepliesSchema = z.object({
  messages: z.array(forumMessageSchema),
});

/**
 * One public forum message from the api.
 */
export type ForumMessage = z.infer<typeof forumMessageSchema>;

/**
 * Runtime schema for `POST /messages/:id/invoice` success body.
 */
export const messageInvoiceSchema = z.object({
  pr: z.string().min(1),
  amountSats: z.number().int().positive(),
});

/**
 * BOLT11 invoice issued for paying a forum message.
 */
export type MessageInvoice = z.infer<typeof messageInvoiceSchema>;

/**
 * Trimmed contact body length accepted by `POST /contact` (api `MESSAGE_MAX_LENGTH`).
 */
export const CONTACT_MESSAGE_MAX_LENGTH = 500;

/**
 * Runtime schema for one in-app contact message from `POST /contact`.
 */
export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  text: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
});

/**
 * One in-app contact message from the api.
 */
export type ContactMessage = z.infer<typeof contactSchema>;

/**
 * Runtime schema for one conversation list row from `GET /conversations`.
 *
 * `kind` is `member_member` (in-app member conversation), `member_platform`
 * (contact / official 21.gifts thread), or `member_damus` (Nostr-only
 * counterpart). `lastText` may be empty when the thread was opened from a
 * forum note and has no messages yet, or when the last row is gift-only
 * (`lastSats > 0`). `lastFromMe` is true when the last message was sent by
 * the session (including staff sending as the platform account). `lastSats`
 * is the satoshis on that last message (0 for text-only). `accountId` is the
 * optional 21.gifts counterpart id on list rows.
 * `unread` is true when the viewer has inbound mail newer than last-read.
 */
export const conversationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['member_member', 'member_platform', 'member_damus']),
  name: z.string().min(1),
  lastText: z.string(),
  lastAt: z.string().datetime({ offset: true }),
  lastFromMe: z.boolean(),
  lastSats: z.number().int().nonnegative(),
  /** Optional 21.gifts counterpart id on list rows. */
  accountId: z.string().min(1).optional(),
  unread: z.boolean().default(false),
});

/**
 * Runtime schema for `GET /conversations`.
 *
 * `unreadCount` defaults to 0 so an older api that omits the field still
 * parses.
 */
export const conversationListSchema = z.object({
  conversations: z.array(conversationSchema),
  unreadCount: z.number().int().nonnegative().default(0),
});

/**
 * One private-message thread from the api.
 */
export type Conversation = z.infer<typeof conversationSchema>;

/**
 * Runtime schema for one message in `GET /conversations/:id`.
 *
 * `fromMe` is true when this message was sent by the session (including staff
 * sending as the platform account). `text` may be empty on a gift-only row
 * (`sats > 0`). `sats` is the validated payment on that message (0 for
 * text-only). `accountId` is the optional 21.gifts sender id on thread
 * messages.
 */
export const conversationMessageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  text: z.string(), // empty allowed (gift-only)
  createdAt: z.string().datetime({ offset: true }),
  fromMe: z.boolean(),
  sats: z.number().int().nonnegative(),
  /** Optional 21.gifts sender id on thread messages. */
  accountId: z.string().min(1).optional(),
});

/**
 * Runtime schema for `GET /conversations/:id`.
 */
export const conversationThreadSchema = z.object({
  messages: z.array(conversationMessageSchema),
});

/**
 * One private message from the api.
 */
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

/**
 * Runtime schema for `POST /conversations/:id/invoice` success body.
 *
 * `messageId` is the predetermined row the client long-polls for after pay.
 */
export const conversationInvoiceSchema = z.object({
  pr: z.string().min(1),
  amountSats: z.number().int().positive(),
  messageId: z.string().min(1),
});

/**
 * BOLT11 invoice issued for paying a private-thread counterpart.
 */
export type ConversationInvoice = z.infer<typeof conversationInvoiceSchema>;

/**
 * Runtime schema for one notification from `GET /notifications`.
 *
 * `type` is `forum_post` (new living-room post), `forum_reply`, `zap`
 * (payment), or `moderator_appointed` (the session was appointed moderator).
 * Unknown `type` values fail parse. `text` may be empty when a post or reply
 * is photo-only, when a zap has no amount string, or when a moderator
 * appointment has no body. `parentId` / `replyId` are a forum note id except
 * on `moderator_appointed`, where they are the subject account id. `readAt`
 * is `null` until the session marks the row read.
 */
export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['forum_post', 'forum_reply', 'zap', 'moderator_appointed']),
  parentId: z.string().min(1),
  replyId: z.string().min(1),
  name: z.string(),
  text: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  readAt: z.string().datetime({ offset: true }).nullable(),
});

/**
 * Runtime schema for `GET /notifications`.
 */
export const notificationListSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});

/**
 * One notification from the api (post, reply, zap, or moderator appointment).
 */
export type Notification = z.infer<typeof notificationSchema>;

/**
 * Signed-in notification list from the api.
 */
export type NotificationList = z.infer<typeof notificationListSchema>;

/**
 * Runtime schema for `GET /push/vapid-public` success body.
 */
export const vapidPublicSchema = z.object({
  publicKey: z.string().min(1),
});

/**
 * VAPID application server public key from the api.
 */
export type VapidPublic = z.infer<typeof vapidPublicSchema>;

/**
 * Runtime schema for `POST /me/push-subscriptions` success body.
 */
export const pushSubscriptionResponseSchema = z.object({
  endpoint: z.string(),
  createdAt: z.string(),
});

/**
 * Confirmed push subscription row from the api.
 */
export type PushSubscriptionResponse = z.infer<typeof pushSubscriptionResponseSchema>;

/**
 * Default all-null trust refs so mixed deploys without `trust` still parse.
 */
const accountTrustNull = {
  verifiedBy: null,
  proposedBy: null,
  confirmedBy: null,
  appointedBy: null,
};

/**
 * Runtime schema for one account named in a trust-chain ref.
 */
export const accountTrustRefSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

/**
 * Runtime schema for who verified, proposed, confirmed, or appointed a member.
 */
export const accountTrustSchema = z.object({
  verifiedBy: accountTrustRefSchema.nullable(),
  proposedBy: accountTrustRefSchema.nullable(),
  confirmedBy: accountTrustRefSchema.nullable(),
  appointedBy: accountTrustRefSchema.nullable(),
});

/**
 * Named refs for a member's place on the Trust Chain.
 */
export type AccountTrust = z.infer<typeof accountTrustSchema>;

/**
 * Runtime schema for a signed-in member profile from `GET /members/:id`.
 *
 * `profileMessage` is the member's profile forum note when present (card Message
 * and posts-feed source, not a pinned ForumBoard card).
 * `postCount` / `replyCount` are uncapped totals; activity feeds are capped at 200.
 * `trust` defaults to all-null when an older api omits the field.
 */
export const memberProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  role: z.enum(['basis', 'verified', 'moderator', 'founder']),
  lightningAddress: z.string().nullable(),
  createdAt: z.string(),
  profileMessage: forumMessageSchema.nullable(),
  postCount: z.number().int().nonnegative(),
  replyCount: z.number().int().nonnegative(),
  /** About me note, or `null` when unfilled. */
  aboutMe: z.string().nullable(),
  /** True when the live profile note has a photo. Optional so older api bodies still parse. */
  aboutMeHasPhoto: z.boolean().optional().default(false),
  trust: accountTrustSchema.optional().default(accountTrustNull),
});

/**
 * Signed-in member profile from the api.
 */
export type MemberProfile = z.infer<typeof memberProfileSchema>;

/**
 * Runtime schema for one node on `GET /trust-chain`.
 */
export const trustChainNodeSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  role: z.enum(['verified', 'moderator', 'founder']),
});

/**
 * Runtime schema for one directed edge on `GET /trust-chain`.
 */
export const trustChainEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(['verify', 'moderator_propose', 'moderator_appoint']),
});

/**
 * Runtime schema for the payload of `GET /trust-chain`.
 */
export const trustChainSchema = z.object({
  nodes: z.array(trustChainNodeSchema),
  edges: z.array(trustChainEdgeSchema),
});

/**
 * Public Trust Chain graph from the api.
 */
export type TrustChain = z.infer<typeof trustChainSchema>;

/**
 * One person on the Trust Chain.
 */
export type TrustChainNode = z.infer<typeof trustChainNodeSchema>;

/**
 * One directed verify / propose / appoint edge.
 */
export type TrustChainEdge = z.infer<typeof trustChainEdgeSchema>;

/**
 * Runtime schema for a successful staff trust POST (`verify` / propose / confirm / appoint).
 */
export const trustActionResultSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  role: z.enum(['basis', 'verified', 'moderator', 'founder']),
});

/**
 * Updated account snapshot after a staff trust action.
 */
export type TrustActionResult = z.infer<typeof trustActionResultSchema>;

/**
 * Runtime schema for one open moderator proposal from `GET /trust/proposals`.
 *
 * `subject.role` is always `verified` (the member is waiting for a second
 * staff confirm). `subject.name` and `proposedBy.name` may be null when the
 * account has no display name yet.
 */
export const moderatorProposalSchema = z.object({
  subject: z.object({
    id: z.string().min(1),
    name: z.string().nullable(),
    role: z.literal('verified'),
  }),
  proposedBy: z.object({
    id: z.string().min(1),
    name: z.string().nullable(),
  }),
  createdAt: z.string().datetime({ offset: true }),
});

/**
 * Runtime schema for the payload of `GET /trust/proposals`.
 */
export const moderatorProposalsResponseSchema = z.object({
  proposals: z.array(moderatorProposalSchema),
});

/**
 * One open moderator proposal from the api.
 */
export type ModeratorProposal = z.infer<typeof moderatorProposalSchema>;
