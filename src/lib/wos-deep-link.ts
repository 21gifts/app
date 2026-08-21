/**
 * Wallet of Satoshi deep links.
 *
 * Generic `lightning:` URIs go to whichever app owns that scheme (often Taro,
 * Phoenix, …). Android can pin the target package; iOS cannot, so the UI
 * copies the LNURL instead of guessing a custom scheme.
 */

/** Play Store / Android application id for Wallet of Satoshi. */
export const WOS_ANDROID_PACKAGE = 'com.livingroomofsatoshi.wallet';

/**
 * Whether `userAgent` looks like Android (the only platform that can pin
 * `lightning:` to Wallet of Satoshi).
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns `true` iff the string contains `Android`.
 */
export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * Android Intent URL that opens this LNURL-auth challenge in Wallet of Satoshi
 * rather than the default `lightning:` handler.
 *
 * @param lnurl - Bech32 `lnurl1…` from `/auth/lnurl` (any casing).
 * @returns An opaque `intent:LNURL…#Intent;scheme=lightning;package=…;end` URL.
 */
export function walletOfSatoshiIntentHref(lnurl: string): string {
  const body = lnurl.toUpperCase();
  return `intent:${body}#Intent;scheme=lightning;package=${WOS_ANDROID_PACKAGE};end`;
}
