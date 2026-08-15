import { z } from 'zod';

/**
 * Runtime schema for an {@link Account} as returned by the api.
 *
 * Kept as the single source of truth: {@link Account} is inferred from it so
 * the compile-time type and the runtime validation can never drift apart.
 */
export const accountSchema = z.object({
  id: z.string(),
  linkingKey: z.string(),
  role: z.enum(['basis', 'moderator']),
  lightningAddress: z.string().nullable(),
  lightningAddressVerified: z.boolean(),
  createdAt: z.number(),
});

/**
 * An authenticated 21.gifts account.
 *
 * `role` gates capabilities (`basis` for ordinary givers, `moderator` for
 * elevated review actions); `linkingKey` is the wallet's LNURL-auth public key.
 * `lightningAddress` is the receiver's `name@domain.tld` address, or `null` when
 * none is linked; `lightningAddressVerified` reports whether ownership has been
 * proven (always `false` in v1).
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
