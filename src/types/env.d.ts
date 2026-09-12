/**
 * Ambient typings for the environment variables this app reads.
 *
 * `tsconfig.json` sets `noPropertyAccessFromIndexSignature`, so every
 * variable accessed as `process.env.FOO` must be declared here. Keep this
 * file in sync with `src/lib/config.ts`, the Dockerfile build placeholders,
 * and `entrypoint.sh`.
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
       * Optional same-origin translation proxy upstream base URL. Missing, empty,
       * or non-http(s) values disable translation (`available: false` / POST 503).
       * Tests assign it.
       */
      TRANSLATE_URL?: string;
      /**
       * Optional LibreTranslate-compatible API key, sent only when `TRANSLATE_URL`
       * is set. Tests assign it.
       */
      TRANSLATE_API_KEY?: string;
      /** Set by CI systems (GitHub Actions sets `"true"`); read by `playwright.config.ts`. */
      readonly CI?: string;
    }
  }
}

export {};
