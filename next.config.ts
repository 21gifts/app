import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

function appVersionForBuild(): string {
  const raw = process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.APP_VERSION ?? 'dev';
  if (raw === '') return 'dev';
  return raw; // no 7-char slice
}

/**
 * `output: 'standalone'` makes `next build` emit a self-contained server
 * under `.next/standalone` — that is what the Dockerfile runtime stage ships.
 * `outputFileTracingRoot` pins that layout to this package even when a parent
 * directory also has a lockfile (Next would otherwise nest standalone).
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: appRoot,
  outputFileTracingIncludes: {
    '/handbook': ['./docs/handbook/**/*'],
    '/handbook/screens': ['./docs/handbook/**/*', './scripts/screen-variants.mjs'],
    '/handbook/functions': ['./docs/handbook/**/*'],
    '/handbook/endpoints': ['./docs/handbook/**/*'],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersionForBuild(),
  },
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://21.gifts/',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
        destination: 'https://21.gifts/:path*',
        permanent: true,
      },
      { source: '/legal.html', destination: '/legal', permanent: true },
    ];
  },
  async headers() {
    const hsts = {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    };
    return [
      {
        source: '/.well-known/nostr.json',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      {
        source: '/.well-known/lnurlp/:username',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
      { source: '/', headers: [hsts] },
      { source: '/:path*', headers: [hsts] },
    ];
  },
};

/**
 * Error reporting build step. Nothing Sentry-specific is configured here: the
 * DSN and environment come from the container at start (see `src/lib/sentry.ts`).
 * No source maps are uploaded and no release is created, so the build needs no
 * token and makes no network calls. Tracing code stays in the bundle for the
 * browser's sampled performance traces (`src/lib/sentry.ts`); the server
 * samples none. Both the server-side auto-wrapping and the build-time
 * instrumentation of server dependencies are off; `onRequestError` in
 * `src/instrumentation.ts` reports request errors. The SDK's `tunnelRoute` is not used because it only
 * rewrites to sentry.io hosts; `/monitoring` is the app's own tunnel.
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  buildTimeInstrumentation: false,
  sourcemaps: { disable: true },
  release: { create: false, finalize: false },
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false,
    treeshake: { removeDebugLogging: true, removeTracing: false },
  },
});
