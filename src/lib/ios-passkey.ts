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
 * Parse the iOS version token. Shared so the block and the reader cannot
 * format a version differently.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns Major plus the installed string, or null.
 */
function parseIosVersion(userAgent: string): { major: number; installed: string } | null {
  if (!/iPhone|iPad|iPod/i.test(userAgent)) {
    return null;
  }
  const match = /\bOS (\d+)[_.](\d+)(?:[_.](\d+))?/.exec(userAgent);
  if (match === null) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = match[3];
  const installed = patch === undefined ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return { major, installed };
}

/**
 * iOS below 18 cannot finish sign-in. Other browsers, and iOS 18 or newer,
 * return null. A missing version token also returns null.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The installed version and the minimum, or null.
 */
export function iosPasskeyBlock(userAgent: string): IosPasskeyBlock | null {
  const parsed = parseIosVersion(userAgent);
  if (parsed === null || parsed.major >= IOS_PASSKEY_MIN_MAJOR) {
    return null;
  }
  return { installed: parsed.installed, required: String(IOS_PASSKEY_MIN_MAJOR) };
}

/**
 * Installed iOS version from an iPhone, iPad, or iPod user agent, including
 * iOS 18 and newer.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The installed version, or null when the token is missing or the
 *   browser is not iOS.
 */
export function iosInstalledVersion(userAgent: string): string | null {
  if (typeof userAgent !== 'string') {
    return null;
  }
  const parsed = parseIosVersion(userAgent);
  return parsed === null ? null : parsed.installed;
}
