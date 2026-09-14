/**
 * Typed accessors for the app's public runtime configuration.
 *
 * Every `NEXT_PUBLIC_*` variable read anywhere in the app goes through this
 * module. Keep it in sync with `src/types/env.d.ts`. `NEXT_PUBLIC_API_URL` is
 * a Dockerfile build placeholder that `entrypoint.sh` substitutes at container
 * start. `NEXT_PUBLIC_GIT_SHA` is baked at `next build` (Docker ARG /
 * `next.config.ts` env) and is not substituted by `entrypoint.sh`.
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
 * Returns the short git SHA of this app build (7 chars), or `dev` when no SHA was baked.
 *
 * Read exclusively through this accessor. Next.js inlines `NEXT_PUBLIC_GIT_SHA`
 * at build time from a literal `process.env.NEXT_PUBLIC_GIT_SHA` expression.
 *
 * @returns The display SHA (`dev` or 7-character git SHA).
 * @throws Error when `NEXT_PUBLIC_GIT_SHA` is unset or empty.
 */
export function getAppVersion(): string {
  // Dot access is load-bearing: Next.js inlines `NEXT_PUBLIC_*` variables at
  // build time only for literal `process.env.NEXT_PUBLIC_GIT_SHA` expressions.
  const value = process.env.NEXT_PUBLIC_GIT_SHA;
  if (value === undefined || value === '') {
    throw new Error(
      'NEXT_PUBLIC_GIT_SHA is not set. Provide it at build time (Docker ARG GIT_SHA or next.config.ts env).',
    );
  }
  return value.length <= 7 ? value : value.slice(0, 7);
}
