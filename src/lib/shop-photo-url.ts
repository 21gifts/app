/**
 * Make one shop photo URL safe to render.
 *
 * The api may send a photo path relative to itself. With `apiBase`, such a
 * path resolves against the api base URL (`getApiUrl()`), trailing slashes
 * trimmed. A root-relative `/path` is appended after the full base, path
 * included (`https://x/v1` + `/a` → `https://x/v1/a`), so an api behind a path
 * prefix still serves its photos. Any other value (relative path, `//host`,
 * absolute URL) resolves with standard URL rules against the base plus `/`, so
 * `//host/…` stays a host, not a path. Without `apiBase`, only an absolute URL
 * is accepted. Either way the result must be `http:` or `https:`; every
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

/** Forum still path the app already proxies at the same origin. */
const FORUM_STILL = /\/messages\/([^/]+)\/photo(?:\/([1-9]))?\.(?:jpe?g|png|webp)$/i;

/**
 * Point a public shop still at the same-origin photo proxy.
 *
 * The api publishes absolute `https://api.21.gifts/messages/…/photo.jpg`
 * URLs (and `.png` / `.webp`). CSP `img-src` allows only `'self'`, so the
 * browser loads `/messages/…/photo.jpg`, which this app proxies. The
 * extension is normalized to `.jpg` because the api serves the stored bytes
 * for every image extension. A URL that is not a forum still is returned
 * unchanged. No I/O.
 *
 * @param url - Absolute photo URL already accepted by {@link resolveShopPhotoUrl}.
 * @returns The same-origin proxy path, or `url` when it is not a forum still.
 */
export function sameOriginShopPhotoSrc(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return url;
  }
  const match = FORUM_STILL.exec(parsed.pathname);
  if (match === null) {
    return url;
  }
  let id: string;
  try {
    // The first group is `[^/]+`, so a match always carries it.
    const rawId = match[1] as string;
    id = encodeURIComponent(decodeURIComponent(rawId));
  } catch {
    return url;
  }
  const index = match[2];
  return index === undefined ? `/messages/${id}/photo.jpg` : `/messages/${id}/photo/${index}.jpg`;
}
