/**
 * Wallet of Satoshi deep links.
 *
 * Generic `lightning:` URIs go to whichever app owns that scheme (often Taro,
 * Phoenix, …). Wallet of Satoshi also registers the custom scheme
 * `walletofsatoshi:`; use that (or an Android Intent that pins both the
 * package and that scheme) as the primary open path. Copy stays a secondary
 * fallback only.
 */

/** Play Store / Android application id for Wallet of Satoshi. */
export const WOS_ANDROID_PACKAGE = 'com.livingroomofsatoshi.wallet';

/** Custom URL scheme registered by Wallet of Satoshi. */
export const WOS_URL_SCHEME = 'walletofsatoshi';

/** Play Store listing used as the Android Intent browser fallback. */
const WOS_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.livingroomofsatoshi.wallet';

/**
 * Whether `userAgent` looks like Android.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns `true` iff the string contains `Android`.
 */
export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

/**
 * Uppercased bech32 LNURL (LUD-01).
 *
 * @param lnurl - Bech32 `lnurl1…` from `/auth/lnurl` (any casing).
 * @returns The same string in uppercase.
 */
export function uppercaseLnurl(lnurl: string): string {
  return lnurl.toUpperCase();
}

/**
 * Custom-scheme deep link that only Wallet of Satoshi registers.
 * `walletofsatoshi:lightning:` + uppercase LNURL, no `//`.
 *
 * @param lnurl - Bech32 `lnurl1…` from `/auth/lnurl` (any casing).
 * @returns e.g. `walletofsatoshi:lightning:LNURL1ABC`.
 */
export function walletOfSatoshiHref(lnurl: string): string {
  return `${WOS_URL_SCHEME}:lightning:${uppercaseLnurl(lnurl)}`;
}

/**
 * Android Intent URL: pin the WoS package AND the custom scheme
 * (not `scheme=lightning`). Body is `lightning:` + uppercase LNURL.
 * Includes a Play Store fallback.
 *
 * @param lnurl - Bech32 `lnurl1…` from `/auth/lnurl` (any casing).
 * @returns An opaque `intent:lightning:LNURL…#Intent;scheme=walletofsatoshi;package=…;S.browser_fallback_url=…;end` URL.
 */
export function walletOfSatoshiIntentHref(lnurl: string): string {
  const body = `lightning:${uppercaseLnurl(lnurl)}`;
  const fallback = encodeURIComponent(WOS_PLAY_STORE_URL);
  return `intent:${body}#Intent;scheme=${WOS_URL_SCHEME};package=${WOS_ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
