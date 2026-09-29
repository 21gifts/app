/** Major iOS version that can finish passkey sign-in. */
const IOS_PASSKEY_MIN_MAJOR = 18;

/** Installed iOS version and the minimum this sign-in needs. */
export interface IosPasskeyBlock {
  /** Installed version, for example `17.5.1`. */
  installed: string;
  /** Minimum major version, `18`. */
  required: string;
}

/**
 * iOS below 18 cannot finish sign-in. Other browsers, and iOS 18 or newer,
 * return null. A missing version token also returns null.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The installed version and the minimum, or null.
 */
export function iosPasskeyBlock(userAgent: string): IosPasskeyBlock | null {
  if (!/iPhone|iPad|iPod/i.test(userAgent)) {
    return null;
  }
  const match = /\bOS (\d+)[_.](\d+)(?:[_.](\d+))?/.exec(userAgent);
  if (match === null) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major >= IOS_PASSKEY_MIN_MAJOR) {
    return null;
  }
  const patch = match[3];
  const installed = patch === undefined ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return { installed, required: String(IOS_PASSKEY_MIN_MAJOR) };
}
