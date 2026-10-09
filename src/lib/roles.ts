/**
 * Account roles as membership order, not the rank sequence: basis, verified,
 * moderator, initiator, founder.
 *
 * Numeric ranks: basis 0, verified 1, moderator 2, initiator 2, founder 3.
 * Viewer permission checks use {@link roleAtLeast}; an equality test on the
 * viewer's role is a defect. The named exception is
 * {@link canEditDailyPayoutRoster}, which is true only for `initiator` and
 * `founder`. Do not write "moderator or initiator" or
 * „Moderator oder Initiator“; permission checks name the minimum rank only.
 */
export const ROLE_ORDER = ['basis', 'verified', 'moderator', 'initiator', 'founder'] as const;

/** One of {@link ROLE_ORDER}. */
export type Role = (typeof ROLE_ORDER)[number];

const ROLE_RANK: Record<Role, number> = {
  basis: 0,
  verified: 1,
  moderator: 2,
  initiator: 2,
  founder: 3,
};

/**
 * Numeric rank of a role from the explicit rank map (not {@link ROLE_ORDER}'s
 * index).
 *
 * @param role - A live account role.
 * @returns Rank from 0 through 3.
 */
export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

/**
 * True when `role` meets or exceeds `min` by numeric rank. An equal rank
 * meets the minimum.
 *
 * `null` and `undefined` are never at least `min`.
 *
 * @param role - Viewer role, or missing when the account snapshot is absent.
 * @param min - Inclusive minimum role.
 * @returns Whether the viewer meets the minimum.
 */
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (role === null || role === undefined) {
    return false;
  }
  return roleRank(role) >= roleRank(min);
}

/**
 * True when the signed-in account wrote this note.
 *
 * A wallet cannot pay its own invoice, so nothing on your own note asks you to
 * pay: no reply fee, no amount, no gift, no heart.
 *
 * @param viewerAccountId - Signed-in account id, or missing when signed out.
 * @param noteAccountId - The note's `accountId`, if the api sent one.
 * @returns Whether both ids are present and equal.
 */
export function isOwnNote(
  viewerAccountId: string | null | undefined,
  noteAccountId: string | undefined,
): boolean {
  return (
    typeof viewerAccountId === 'string' &&
    viewerAccountId !== '' &&
    viewerAccountId === noteAccountId
  );
}

/**
 * True when the signed-in account may reply without paying.
 *
 * Anyone at least verified is exempt, and every role is exempt on its own
 * note ({@link isOwnNote}). Basis on someone else's note must pay 1 sat to
 * 21.gifts to write.
 *
 * @param account - Live account, or `null` when the snapshot is missing.
 * @param parentAccountId - Parent note `accountId`, if the api sent one.
 *   Missing id is not treated as exempt; the caller may POST unpaid and map 403.
 * @returns Whether `POST /messages` is allowed without a zap.
 */
export function isReplyPaymentExempt(
  account: { id: string; role: Role } | null,
  parentAccountId: string | undefined,
): boolean {
  if (account === null) {
    return false;
  }
  return isOwnNote(account.id, parentAccountId) || roleAtLeast(account.role, 'verified');
}

/**
 * True when the signed-in account may edit the daily payout roster.
 *
 * False for `null` and `undefined`. True only for `initiator` and `founder`.
 * This is not {@link roleAtLeast}: initiator and moderator share rank 2, and
 * this page is closed to moderators.
 *
 * @param role - Viewer role, or missing when the account snapshot is absent.
 * @returns Whether the viewer may edit the daily payout roster.
 */
export function canEditDailyPayoutRoster(role: Role | null | undefined): boolean {
  return role === 'initiator' || role === 'founder';
}
