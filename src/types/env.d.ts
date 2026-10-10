/**
 * Ambient typings for the environment variables this app reads.
 *
 * `tsconfig.json` sets `noPropertyAccessFromIndexSignature`, so every
 * variable accessed as `process.env.FOO` must be declared here. Keep this
 * file in sync with `src/lib/config.ts`. `NEXT_PUBLIC_API_URL` is a Dockerfile
 * build placeholder substituted by `entrypoint.sh` at container start.
 * `NEXT_PUBLIC_APP_VERSION` is baked at `next build` via Docker ARG
 * `APP_VERSION` / `next.config.ts` env, not an `entrypoint.sh` placeholder.
 * `NEXT_PUBLIC_BREEZ_API_KEY` is read through `getBreezApiKey`.
 * `NEXT_PUBLIC_PLATFORM_USERNAME`, `NEXT_PUBLIC_SENTRY_DSN`, and
 * `NEXT_PUBLIC_SENTRY_ENVIRONMENT` are optional `entrypoint.sh` placeholders
 * read through `getPlatformUsername`, `getSentryDsn`, and
 * `getSentryEnvironment`.
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * Upstream base URL of the 21.gifts api (server-side proxy).
       * DEV: `https://dev-api.21.gifts` — PRD: `https://api.21.gifts`.
       * Read exclusively through `getApiUrl()` in `src/lib/config.ts`.
       * Not `readonly`: unit tests assign it to exercise both branches.
       */
      NEXT_PUBLIC_API_URL?: string;
      /**
       * Menu version of this app build, inlined at `next build`.
       * Read exclusively through `getAppVersion()` in `src/lib/config.ts`.
       * Baked via Docker ARG `APP_VERSION` / `next.config.ts` env — not an
       * `entrypoint.sh` placeholder. Tests assign `NEXT_PUBLIC_APP_VERSION`.
       */
      NEXT_PUBLIC_APP_VERSION?: string;
      /**
       * Optional Playwright instant (`YYYY-MM-DDTHH:mm:ss.sssZ`).
       * Read exclusively through `getE2eNow()` in `src/lib/config.ts`.
       * Unset in production. Tests assign `NEXT_PUBLIC_E2E_NOW`.
       */
      NEXT_PUBLIC_E2E_NOW?: string;
      /**
       * Optional Breez API key for the in-app wallet.
       * Read exclusively through `getBreezApiKey()` in `src/lib/config.ts`.
       * Unset or empty disables the wallet. Tests assign it.
       */
      NEXT_PUBLIC_BREEZ_API_KEY?: string;
      /**
       * Optional username of the 21.gifts platform account, whose in-app
       * wallet address receives donations to the project.
       * Read exclusively through `getPlatformUsername()` in `src/lib/config.ts`.
       * An optional `entrypoint.sh` placeholder, set per deployment. Tests assign it.
       */
      NEXT_PUBLIC_PLATFORM_USERNAME?: string;
      /**
       * Optional error-reporting DSN. Empty or unset turns error reporting off.
       * Read exclusively through `getSentryDsn()` in `src/lib/config.ts`.
       * An optional `entrypoint.sh` placeholder. Tests assign it.
       */
      NEXT_PUBLIC_SENTRY_DSN?: string;
      /**
       * Optional error-reporting environment name (e.g. `staging`).
       * Read exclusively through `getSentryEnvironment()` in `src/lib/config.ts`.
       * An optional `entrypoint.sh` placeholder. Tests assign it.
       */
      NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
      /**
       * Docker build-arg / CI deploy run number consumed by `next.config.ts`
       * when baking `NEXT_PUBLIC_APP_VERSION`. Not an `entrypoint.sh` placeholder.
       */
      APP_VERSION?: string;
      /** Set by CI systems (GitHub Actions sets `"true"`); read by `playwright.config.ts`. */
      readonly CI?: string;
    }
  }
}

export {};
