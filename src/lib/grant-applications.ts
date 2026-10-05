/**
 * Whether new grant applications are switched off.
 *
 * The apply walk and `POST /funding/apply` stay in the code. While this
 * returns true, a verified account whose username is not in
 * `GRANT_APPLICATION_STILL_OPEN_USERNAMES` and whose status is not pending,
 * trial, or admitted sees the pause card. Those usernames skip that card.
 * A basis account sees "You are not verified yet." on the grants card, and
 * on the apply screen only when that card is open. A basis account that
 * does not skip the card, and whose status is not pending, trial, or
 * admitted, sees the pause card on the apply screen. The API refuses
 * everyone else.
 *
 * @returns `true` while applications are paused.
 */
export function grantApplicationsPaused(): boolean {
  return true;
}

/**
 * Usernames that skip the pause card while applications are paused.
 * Skipping the card is not the apply walk: role and funding status still decide.
 */
export const GRANT_APPLICATION_STILL_OPEN_USERNAMES: readonly string[] = [
  'joey-rosima',
  'vincent',
  'jewel-bacolbas',
];

/**
 * Whether this signed-in username skips the pause card while applications
 * are paused. Exact match. It does not by itself open the apply walk: a
 * basis account on the open card still sees "You are not verified yet."
 * Null, omitted, and every other username do not skip the card.
 *
 * @param username - Account username, or null or undefined when it is unset.
 * @returns `true` only for `joey-rosima`, `vincent`, and `jewel-bacolbas`.
 */
export function grantApplicationStillOpen(username: string | null | undefined): boolean {
  return (
    typeof username === 'string' &&
    (GRANT_APPLICATION_STILL_OPEN_USERNAMES as readonly string[]).includes(username)
  );
}
