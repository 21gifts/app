/**
 * Ambient typings for the environment variables this app reads.
 *
 * `tsconfig.json` sets `noPropertyAccessFromIndexSignature`, so every
 * variable accessed as `process.env.FOO` must be declared here. Keep this
 * file in sync with `src/lib/config.ts`. `NEXT_PUBLIC_API_URL` is a Dockerfile
 * build placeholder substituted by `entrypoint.sh` at container start.
 * `NEXT_PUBLIC_GIT_SHA` is baked at `next build` (Docker ARG `GIT_SHA` /
 * `next.config.ts` env), not a runtime placeholder.
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
       * Short git SHA of this app build, inlined at `next build`.
       * Read exclusively through `getAppVersion()` in `src/lib/config.ts`.
       * Baked via Docker ARG `GIT_SHA` / `next.config.ts` env — not an
       * `entrypoint.sh` placeholder. Tests assign it.
       */
      NEXT_PUBLIC_GIT_SHA?: string;
      /**
       * Docker build-arg / CI git SHA consumed by `next.config.ts` when baking
       * `NEXT_PUBLIC_GIT_SHA`. Not an `entrypoint.sh` placeholder.
       */
      GIT_SHA?: string;
      /**
       * Full DeepL API v2 POST URL, used as-is (example: `https://api.deepl.com/v2/translate`).
       * Missing, empty, or non-http(s) values disable translation.
       * Tests assign it.
       */
      TRANSLATE_URL?: string;
      /**
       * Required DeepL auth key. Missing or empty disables translation even when
       * the URL is set. Tests assign it.
       */
      TRANSLATE_API_KEY?: string;
      /** Set by CI systems (GitHub Actions sets `"true"`); read by `playwright.config.ts`. */
      readonly CI?: string;
    }
  }
}

export {};
