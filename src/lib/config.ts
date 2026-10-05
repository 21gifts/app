/**
 * Typed accessors for the app's public runtime configuration.
 *
 * Every `NEXT_PUBLIC_*` variable read anywhere in the app goes through this
 * module. Keep it in sync with `src/types/env.d.ts`. `NEXT_PUBLIC_API_URL` is
 * a Dockerfile build placeholder that `entrypoint.sh` substitutes at container
 * start. `NEXT_PUBLIC_APP_VERSION` is baked at `next build`, not substituted by
 * `entrypoint.sh`. `NEXT_PUBLIC_BREEZ_API_KEY` is read through `getBreezApiKey`.
 * `NEXT_PUBLIC_PLATFORM_USERNAME`, `NEXT_PUBLIC_SENTRY_DSN`, and
 * `NEXT_PUBLIC_SENTRY_ENVIRONMENT` are optional Dockerfile placeholders:
 * `entrypoint.sh` substitutes an empty string when the container has no value,
 * which hides the donation address or turns error reporting off.
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

/**
 * Optional Breez API key (`NEXT_PUBLIC_BREEZ_API_KEY`). Unset or empty disables
 * the in-app wallet. The key is public by nature in a web bundle. Does not throw.
 *
 * Dot access is load-bearing so Next inlines the value when the build sets it.
 *
 * @returns The configured key, or `null` when unset or empty.
 */
export function getBreezApiKey(): string | null {
  const value = process.env.NEXT_PUBLIC_BREEZ_API_KEY;
  if (value === undefined || value === '') {
    return null;
  }
  return value;
}

/**
 * Optional username of the 21.gifts platform account
 * (`NEXT_PUBLIC_PLATFORM_USERNAME`), set per deployment. Donations to the
 * project go to that account's in-app wallet address `<username>@<app host>`.
 * Unset, empty, or blank means the landing page shows no donation address.
 * Does not throw.
 *
 * In the Docker image the build inlines the `__NEXT_PUBLIC_PLATFORM_USERNAME__`
 * placeholder and `entrypoint.sh` substitutes the container value, or an empty
 * string, at start. The blank check is a regular expression on purpose: the
 * minifier cannot fold it against the placeholder literal, so the substituted
 * empty string still reads as unset.
 *
 * @returns The trimmed username, or `null` when unset or blank.
 */
export function getPlatformUsername(): string | null {
  const value = process.env.NEXT_PUBLIC_PLATFORM_USERNAME;
  if (value === undefined || !/\S/.test(value)) {
    return null;
  }
  return value.trim();
}

/**
 * Optional error-reporting DSN (`NEXT_PUBLIC_SENTRY_DSN`). Unset, empty, or
 * blank turns error reporting off. Does not throw.
 *
 * In the Docker image the build inlines the `__NEXT_PUBLIC_SENTRY_DSN__`
 * placeholder into the browser and server bundles, and `entrypoint.sh`
 * substitutes the container value, or an empty string, at start. The blank
 * check is a regular expression on purpose: the minifier cannot fold it
 * against the placeholder literal, so the substituted empty string still
 * reads as off.
 *
 * @returns The trimmed DSN, or `null` when unset or blank.
 */
export function getSentryDsn(): string | null {
  const value = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (value === undefined || !/\S/.test(value)) {
    return null;
  }
  return value.trim();
}

/**
 * Optional error-reporting environment name (`NEXT_PUBLIC_SENTRY_ENVIRONMENT`),
 * e.g. `staging`. Unset, empty, or blank means the reports carry no
 * environment name. Does not throw. Delivered like {@link getSentryDsn}.
 *
 * @returns The trimmed name, or `null` when unset or blank.
 */
export function getSentryEnvironment(): string | null {
  const value = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;
  if (value === undefined || !/\S/.test(value)) {
    return null;
  }
  return value.trim();
}
