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
 * elevated review actions); `linkingKey` is the wallet's LNURL-auth public key,
 * or `null` for passkey-created accounts that have not bound a wallet.
 * `name` is the non-empty display name, or `null` until the giver sets one.
 * `lightningAddress` is the receiver's `name@domain.tld` address, or `null` when
 * none is linked. `lightningAddressVerified` is accepted from the api (proof-of-
 * control flag) but unused in the UI — live verification payments are not
 * configured on the api.
 */
export type Account = z.infer<typeof accountSchema>;

/**
 * Runtime schema for the payload of `GET /auth/lnurl`.
 *
 * `k1` is the public challenge encoded into the QR; `pollToken` is the secret
 * the client sends back (in the `X-Poll-Token` header) while polling.
 */
export const startChallengeSchema = z.object({
  lnurl: z.string(),
  k1: z.string(),
  pollToken: z.string(),
  expiresInSeconds: z.number(),
});

/**
 * A freshly minted LNURL-auth challenge to render and poll against.
 */
export type StartChallenge = z.infer<typeof startChallengeSchema>;

/**
 * Runtime schema for the payload of `GET /auth/session`.
 *
 * Modelled as a discriminated union on `status`: `token` and `account` exist
 * only in the `'authenticated'` variant and are required there. This makes an
 * `'authenticated'` response that omits them a hard validation failure (fail
 * loud) rather than a silently-ignored state, and lets callers narrow on
 * `status` without defensive undefined checks.
 */
export const sessionResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('used') }),
  z.object({ status: z.literal('authenticated'), token: z.string(), account: accountSchema }),
]);

/**
 * The current state of an LNURL-auth challenge as seen by the poller.
 */
export type SessionResult = z.infer<typeof sessionResultSchema>;

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
