/**
 * Links that hand a payment request to whatever Bitcoin wallet app the
 * visitor's device has, and the smartphone check that decides whether an
 * invoice QR is shown next to that link.
 */

/**
 * Whether `userAgent` is a smartphone (not a desktop and not a tablet).
 *
 * iPhone and iPod are phones. Android is a phone only when the UA also
 * contains `Mobile` (Android tablets typically omit it). iPad is not a
 * smartphone. Viewport width is irrelevant.
 *
 * @param userAgent - `navigator.userAgent`.
 * @returns `true` iff this UA is a smartphone.
 */
export function isSmartphoneUserAgent(userAgent: string): boolean {
  if (/iPhone|iPod/i.test(userAgent)) {
    return true;
  }
  if (/Android/i.test(userAgent) && /Mobile/i.test(userAgent)) {
    return true;
  }
  return false;
}

/**
 * Generic `lightning:` URI for a payment request or address. The device opens
 * the wallet app that handles that scheme; no particular wallet is named.
 *
 * @param request - Payment request (BOLT11) or `name@domain` address, as issued.
 * @returns e.g. `lightning:lnbc21n1…` or `lightning:alice@21.gifts`.
 */
export function lightningHref(request: string): string {
  return `lightning:${request.trim()}`;
}
