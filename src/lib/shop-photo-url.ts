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

/** Api forum photo paths the app proxies on its own origin (any still type; the api serves by index). */
const API_COVER_PHOTO =
  /^\/messages\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/photo(?:\.(?:jpe?g|png|webp))?$/i;
const API_EXTRA_PHOTO =
  /^\/messages\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/photo\/([1-9])\.(?:jpe?g|png|webp)$/i;

/**
 * Same-origin path of a shop photo the api sends as its own forum photo path.
 *
 * The app proxies forum photos at `/messages/:id/photo.jpg` and
 * `/messages/:id/photo/:n.jpg`, and the api serves a still by its index
 * whatever the extension, so the page loads shop photos from its own origin,
 * as the Content-Security-Policy requires (`img-src 'self'`). A relative
 * `og:image` resolves against the site, so link previews use the same path.
 *
 * @param url - Photo URL from `GET /shops/:npub`.
 * @returns `/messages/:id/photo.jpg` or `/messages/:id/photo/:n.jpg`, or null for any other value.
 */
export function sameOriginShopPhotoPath(url: string): string | null {
  const cover = API_COVER_PHOTO.exec(url);
  if (cover !== null) return `/messages/${(cover[1] as string).toLowerCase()}/photo.jpg`;
  const extra = API_EXTRA_PHOTO.exec(url);
  if (extra !== null) {
    return `/messages/${(extra[1] as string).toLowerCase()}/photo/${extra[2] as string}.jpg`;
  }
  return null;
}
