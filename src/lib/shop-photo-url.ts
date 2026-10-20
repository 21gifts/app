/**
 * Make one shop photo URL safe to render.
 *
 * The api may send a photo path relative to itself. With `apiBase`, such a
 * path resolves against the api base URL (`getApiUrl()`), the same way the
 * same-origin proxies build upstream URLs: a root-relative `/path` is appended
 * to the base including its path (`https://x/v1` + `/a` → `https://x/v1/a`),
 * and any other value (relative path, `//host`, absolute URL) resolves with
 * standard URL rules against the base plus `/`. Without `apiBase`, only an absolute
 * URL is accepted. Either way the result must be `http:` or `https:`; every
 * other scheme (`javascript:`, `data:`, …) and an unparsable value is dropped.
 *
 * @param url - Photo URL from `GET /shops/:npub`.
 * @param apiBase - Api base URL for relative paths; omit in the browser, which has no api base.
 * @returns The absolute http(s) URL, or null when the photo must not render.
 */
export function resolveShopPhotoUrl(url: string, apiBase?: string): string | null {
  let parsed: URL;
  try {
    if (apiBase === undefined) {
      parsed = new URL(url);
    } else {
      const base = apiBase.replace(/\/+$/, '');
      // `/path` joins after the api base path; `//host` stays protocol-relative.
      parsed = /^\/(?!\/)/.test(url) ? new URL(`${base}${url}`) : new URL(url, `${base}/`);
    }
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
}
