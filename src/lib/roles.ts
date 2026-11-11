/**
 * Account roles in rank order: basis, verified, moderator, fond,
 * software_developer, initiator, founder.
 *
 * Numeric ranks: basis 0, verified 1, moderator 2, fond 3, software_developer 4,
 * initiator 5, founder 6. Every viewer permission check, including the daily
 * payout roster in {@link canEditDailyPayoutRoster}, is a {@link roleAtLeast}
 * minimum; an equality test on the viewer's role is a defect. Do not write
 * "moderator or initiator" or „Moderator oder Initiator“; permission checks
 * name the minimum rank only.
 */
export const ROLE_ORDER = [
  'basis',
  'verified',
  'moderator',
  'fond',
  'software_developer',
  'initiator',
  'founder',
] as const;

/** One of {@link ROLE_ORDER}. */
export type Role = (typeof ROLE_ORDER)[number];

const ROLE_RANK: Record<Role, number> = {
  basis: 0,
  verified: 1,
  moderator: 2,
  fond: 3,
  software_developer: 4,
  initiator: 5,
  founder: 6,
};

/**
 * Numeric rank of a role from the explicit rank map (not {@link ROLE_ORDER}'s
 * index).
 *
 * @param role - A live account role.
 * @returns Rank from 0 through 6.
 */
export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

/**
 * Role including the older api's `staffTag` compatibility bridge.
 *
 * Before the api sends `role: 'software_developer'`, it sends a lower role
 * (`basis`, `verified`, `moderator`, or `fond`, usually `verified`) plus
 * `staffTag: 'software_developer'`. This promotes that member to
 * `software_developer` for display only: role tags and the Active feed filter.
 * Viewer permission checks deliberately use `account.role` from the api. A
 * role already at or above `software_developer` (`software_developer`,
 * `initiator`, and `founder`) is unchanged, as is a member without the
 * compatibility label or with an unknown value.
 *
 * @param role - Live account role from the api.
 * @param staffTag - Older api compatibility label when present, otherwise null
 *   or omitted.
 * @returns The effective role, including the compatibility bridge.
 */
export function effectiveRole(role: Role, staffTag?: string | null): Role {
  if (staffTag === 'software_developer' && roleRank(role) < roleRank('software_developer')) {
    return 'software_developer';
  }
  return role;
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
 * True when a pay action on this note targets a member who cannot receive yet:
 * the api sent `authorCanReceive: false` for a live member note that is not
 * the viewer's own. An older api body without the field is not this case.
 *
 * Every pay control toward that author shows disabled, and a reply to that
 * note never invoices a gift to the author.
 *
 * @param note - The note's `authorCanReceive`, `accountId`, and `deletedAt`.
 * @param viewerAccountId - Signed-in account id, or missing when signed out.
 * @returns Whether the pay controls toward the author show disabled.
 */
export function authorCannotReceive(
  note: {
    authorCanReceive?: boolean | undefined;
    accountId?: string | undefined;
    deletedAt?: string | undefined;
  },
  viewerAccountId: string | null | undefined,
): boolean {
  return (
    note.authorCanReceive === false &&
    note.accountId !== undefined &&
    note.deletedAt === undefined &&
    !isOwnNote(viewerAccountId, note.accountId)
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
 * The roster's minimum rank is `initiator`: true for `initiator` and
 * `founder`, false for every lower role (including `fond` and
 * `software_developer`) and for `null` / `undefined`.
 *
 * @param role - Viewer role, or missing when the account snapshot is absent.
 * @returns Whether the viewer may edit the daily payout roster.
 */
export function canEditDailyPayoutRoster(role: Role | null | undefined): boolean {
  return roleAtLeast(role, 'initiator');
}
