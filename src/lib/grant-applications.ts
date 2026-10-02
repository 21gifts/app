/**
 * Whether new grant applications are switched off.
 *
 * The apply walk and `POST /funding/apply` stay in the code. While this
 * returns true, the three screens hide the walk except for
 * `GRANT_APPLICATION_STILL_OPEN_USERNAMES`. The API refuses everyone else.
 *
 * @returns `true` while applications are paused.
 */
export function grantApplicationsPaused(): boolean {
  return true;
}

/** Usernames that still see the grant apply walk while applications are paused. */
export const GRANT_APPLICATION_STILL_OPEN_USERNAMES: readonly string[] = [
  'joey-rosima',
  'vincent',
  'jewel-bacolbas',
];

/**
 * Whether this signed-in username still gets the apply walk while applications are paused.
 * Exact match. Null, omitted, and every other username do not.
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
