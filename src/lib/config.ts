/**
 * Typed accessors for the app's public runtime configuration.
 *
 * Every `NEXT_PUBLIC_*` variable read anywhere in the app goes through this
 * module. Keep it in sync with `src/types/env.d.ts`. `NEXT_PUBLIC_API_URL` is
 * a Dockerfile build placeholder that `entrypoint.sh` substitutes at container
 * start. `NEXT_PUBLIC_APP_VERSION` is baked at `next build`, not substituted by
 * `entrypoint.sh`.
 */

/**
 * Returns the upstream base URL of the 21.gifts api (server-side proxy).
 *
 * DEV: `https://dev-api.21.gifts` — PRD: `https://api.21.gifts`.
 * The browser does not call this host; it uses same-origin `/auth`, `/me`.
 *
 * @returns The configured api base URL.
 * @throws Error when `NEXT_PUBLIC_API_URL` is unset or empty — a silent
 * fallback would only surface as broken requests much later.
 */
export function getApiUrl(): string {
  // Dot access is load-bearing: Next.js inlines `NEXT_PUBLIC_*` variables at
  // build time only for literal `process.env.NEXT_PUBLIC_API_URL` expressions.
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (value === undefined || value === '') {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set. Provide it at build time, or run the Docker image whose entrypoint.sh substitutes the __NEXT_PUBLIC_API_URL__ placeholder at container start.',
    );
  }
  return value;
}

/**
 * Returns the Menu version of this app build: a decimal deploy run number, or `dev`.
 *
 * Read exclusively through this accessor. Next.js inlines `NEXT_PUBLIC_APP_VERSION`
 * at build time from a literal `process.env.NEXT_PUBLIC_APP_VERSION` expression.
 *
 * @returns The display version (`dev` or a decimal run number string).
 * @throws Error when `NEXT_PUBLIC_APP_VERSION` is unset or empty.
 */
export function getAppVersion(): string {
  // Dot access is load-bearing: Next.js inlines `NEXT_PUBLIC_*` variables at
  // build time only for literal `process.env.NEXT_PUBLIC_APP_VERSION` expressions.
  const value = process.env.NEXT_PUBLIC_APP_VERSION;
  if (value === undefined || value === '') {
    throw new Error(
      'NEXT_PUBLIC_APP_VERSION is not set. Provide it at build time (Docker ARG APP_VERSION or next.config.ts env).',
    );
  }
  return value; // do not slice
}

/**
 * Optional Playwright clock (`NEXT_PUBLIC_E2E_NOW`). Absent in production.
 *
 * Not a deploy setting: an empty value means the head script uses the device
 * clock. It does not throw, and it does not invent a time.
 *
 * Dot access is load-bearing so Next inlines the value when the test build
 * sets it.
 *
 * @returns The pinned instant, or `null` when unset.
 */
export function getE2eNow(): string | null {
  const value = process.env.NEXT_PUBLIC_E2E_NOW;
  if (value === undefined || value === '') {
    return null;
  }
  return value;
}
