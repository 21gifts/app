/**
 * Whether new grant applications are switched off.
 *
 * The apply walk and `POST /funding/apply` stay in the code. While this
 * returns true they are not offered and the API does not write a grant.
 *
 * @returns `true` while applications are paused.
 */
export function grantApplicationsPaused(): boolean {
  return true;
}
