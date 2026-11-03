/**
 * Content-Security-Policy of every page and route the middleware matches.
 *
 * The middleware builds the policy per request with a fresh nonce. Next.js
 * reads that nonce from the request header and puts it on its own scripts;
 * the root layout puts it on its inline bootstrap scripts. `'strict-dynamic'`
 * lets those scripts load the next chunks, the wallet SDK, and the map
 * script. Every other source is listed in {@link CSP_SOURCES}, and
 * `docs/csp.md` says why each one is needed.
 *
 * `CSP_MODE=enforce` sends the policy as `Content-Security-Policy`. Unset or
 * any other value sends `Content-Security-Policy-Report-Only`. Reports go to
 * {@link CSP_REPORT_PATH}.
 */

/** Same-origin path that receives violation reports. */
export const CSP_REPORT_PATH = '/monitoring/csp';

/** `report-to` group name, defined by the `Reporting-Endpoints` header. */
export const CSP_REPORT_GROUP = 'csp';

/** Request header that carries the nonce from the middleware to the layout. */
export const CSP_NONCE_HEADER = 'x-nonce';

/** Report-only or enforced. */
export type CspMode = 'report-only' | 'enforce';

/**
 * Sources per directive, without the nonce and without the report
 * directives. Order is kept in the header. `docs/csp.md` gives the reason
 * for each source.
 */
export const CSP_SOURCES: Readonly<Record<string, readonly string[]>> = {
  'default-src': ["'self'"],
  // The nonce is added per request; `'strict-dynamic'` trusts what nonce'd
  // scripts load (chunks, wallet SDK, map script). Wasm compile for the SDK.
  'script-src': ["'self'", "'strict-dynamic'", "'wasm-unsafe-eval'"],
  // Style attributes, the map's own style elements, and its font stylesheet.
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  // QR codes and avatars (data:), photo previews (blob:), map tiles and icons.
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    'https://*.ggpht.com',
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  // Video previews before upload.
  'media-src': ["'self'", 'blob:'],
  // Wallet SDK: Spark operators, Breez services, and any receiver's
  // Lightning-address server, so any https origin; its Nostr relays.
  'connect-src': [
    "'self'",
    'https:',
    'wss://nr1.breez.technology',
    'wss://relay.damus.io',
    'wss://relaypag.es',
  ],
  // The push service worker; the map's vector renderer.
  'worker-src': ["'self'", 'blob:'],
  'manifest-src': ["'self'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

/**
 * Mode from `CSP_MODE`, read on every request so the same image can switch
 * without a rebuild.
 *
 * @returns `enforce` only when `CSP_MODE` is exactly `enforce`.
 */
export function getCspMode(): CspMode {
  return process.env.CSP_MODE === 'enforce' ? 'enforce' : 'report-only';
}

/**
 * Response header name for a mode.
 *
 * @param mode - Report-only or enforced.
 * @returns `Content-Security-Policy` or `Content-Security-Policy-Report-Only`.
 */
export function cspHeaderName(mode: CspMode): string {
  return mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
}

/**
 * A random nonce: 16 bytes, base64.
 *
 * @returns A new nonce.
 */
export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The policy text.
 *
 * @param nonce - Nonce of this response.
 * @returns Directives from {@link CSP_SOURCES}, the nonce on `script-src`,
 * and `report-uri` plus `report-to`.
 */
export function buildCsp(nonce: string): string {
  const directives = Object.entries(CSP_SOURCES).map(([name, sources]) => {
    const list = name === 'script-src' ? [`'nonce-${nonce}'`, ...sources] : sources;
    return `${name} ${list.join(' ')}`;
  });
  directives.push(`report-uri ${CSP_REPORT_PATH}`, `report-to ${CSP_REPORT_GROUP}`);
  return directives.join('; ');
}
