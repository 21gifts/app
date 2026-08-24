import { z } from 'zod';

/**
 * Runtime schema for an {@link Account} as returned by the api.
 *
 * Kept as the single source of truth: {@link Account} is inferred from it so
 * the compile-time type and the runtime validation can never drift apart.
 */
export const accountSchema = z.object({
  id: z.string(),
  linkingKey: z.string().nullable(),
  role: z.enum(['basis', 'moderator']),
  name: z.string().min(1).nullable(),
  lightningAddress: z.string().nullable(),
  lightningAddressVerified: z.boolean(),
  createdAt: z.number(),
});

/**
 * An authenticated 21.gifts account.
 *
 * `role` gates capabilities (`basis` for ordinary givers, `moderator` for
 * elevated review actions); `linkingKey` is a leftover wallet public key from
 * the retired LNURL-auth login, or `null` for passkey-created accounts.
 * `name` is the non-empty display name, or `null` until the giver sets one.
 * `lightningAddress` is the receiver's `name@domain.tld` address, or `null` when
 * none is linked. `lightningAddressVerified` is accepted from the api (proof-of-
 * control flag) but unused in the UI — live verification payments are not
 * configured on the api.
 */
export type Account = z.infer<typeof accountSchema>;

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

/**
 * One UTC day in the cumulative spend series from `GET /gifts/stats`.
 */
export const spendDaySchema = z.object({
  day: z.string(),
  sats: z.number().int().nonnegative(),
  cumulativeSats: z.number().int().nonnegative(),
});

/**
 * Per-recipient totals from `GET /gifts/stats`.
 */
export const recipientSpendSchema = z.object({
  recipient: z.string(),
  giftCount: z.number().int().nonnegative(),
  sats: z.number().int().nonnegative(),
});

/**
 * Per-month totals from `GET /gifts/stats`.
 */
export const monthSpendSchema = z.object({
  month: z.string(),
  giftCount: z.number().int().nonnegative(),
  sats: z.number().int().nonnegative(),
});

/**
 * Runtime schema for the payload of `GET /gifts/stats`.
 */
export const giftStatsSchema = z.object({
  totalSats: z.number().int().nonnegative(),
  giftCount: z.number().int().nonnegative(),
  recipientCount: z.number().int().nonnegative(),
  firstPaidAt: z.string().nullable(),
  lastPaidAt: z.string().nullable(),
  spendOverTime: z.array(spendDaySchema),
  byRecipient: z.array(recipientSpendSchema),
  byMonth: z.array(monthSpendSchema),
});

/**
 * Aggregated outbound gift statistics from the api.
 */
export type GiftStats = z.infer<typeof giftStatsSchema>;

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
