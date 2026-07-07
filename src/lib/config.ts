/**
 * Typed accessors for the app's public runtime configuration.
 *
 * Every `NEXT_PUBLIC_*` variable read anywhere in the app goes through this
 * module. Keep it in sync with `src/types/env.d.ts`, the Dockerfile build
 * placeholders, and `entrypoint.sh` (which substitutes the placeholders at
 * container start).
 */

/**
 * Returns the base URL of the 21.gifts api.
 *
 * DEV: `https://dev-api.21.gifts` — PRD: `https://api.21.gifts`.
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
