/** Major Android version that can finish a new-account passkey. */
const ANDROID_PASSKEY_MIN_MAJOR = 9;

/** Installed Android version and the minimum this sign-in needs. */
export interface AndroidPasskeyBlock {
  /** Installed version, for example `8.1.0`. */
  installed: string;
  /** Minimum major version, `9`. */
  required: string;
}

/**
 * Parse the Android version token. Shared so the block and the reader cannot
 * format a version differently.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns Major plus the installed string, or null.
 */
function parseAndroidVersion(userAgent: string): { major: number; installed: string } | null {
  if (typeof userAgent !== 'string') {
    return null;
  }
  const match = /\bAndroid (\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(userAgent);
  if (match === null) {
    return null;
  }
  const majorText = `${match[1]}`.slice(0, 8);
  const minorText = match[2] === undefined ? undefined : `${match[2]}`.slice(0, 8);
  const patchText = match[3] === undefined ? undefined : `${match[3]}`.slice(0, 8);
  const major = Number(majorText);
  let installed: string;
  if (minorText === undefined) {
    installed = majorText;
  } else if (patchText === undefined) {
    installed = `${majorText}.${minorText}`;
  } else {
    installed = `${majorText}.${minorText}.${patchText}`;
  }
  return { major, installed };
}

/**
 * Android below 9 cannot finish a new-account passkey. Other browsers, and
 * Android 9 or newer, return null. A missing version token also returns null.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The installed version and the minimum, or null.
 */
export function androidPasskeyBlock(userAgent: string): AndroidPasskeyBlock | null {
  const parsed = parseAndroidVersion(userAgent);
  if (parsed === null || parsed.major >= ANDROID_PASSKEY_MIN_MAJOR) {
    return null;
  }
  return { installed: parsed.installed, required: String(ANDROID_PASSKEY_MIN_MAJOR) };
}

/**
 * Installed Android version from a user agent, including Android 9 and newer.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns The installed version, or null when the token is missing.
 */
export function androidInstalledVersion(userAgent: string): string | null {
  const parsed = parseAndroidVersion(userAgent);
  return parsed === null ? null : parsed.installed;
}
