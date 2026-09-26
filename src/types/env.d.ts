/**
 * Ambient typings for the environment variables this app reads.
 *
 * `tsconfig.json` sets `noPropertyAccessFromIndexSignature`, so every
 * variable accessed as `process.env.FOO` must be declared here. Keep this
 * file in sync with `src/lib/config.ts`. `NEXT_PUBLIC_API_URL` is a Dockerfile
 * build placeholder substituted by `entrypoint.sh` at container start.
 * `NEXT_PUBLIC_APP_VERSION` is baked at `next build` via Docker ARG
 * `APP_VERSION` / `next.config.ts` env, not an `entrypoint.sh` placeholder.
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
