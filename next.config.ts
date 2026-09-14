import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

function gitShaForBuild(): string {
  const raw = process.env.NEXT_PUBLIC_GIT_SHA ?? process.env.GIT_SHA ?? 'dev';
  if (raw === '') return 'dev';
  return raw.length <= 7 ? raw : raw.slice(0, 7);
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
    NEXT_PUBLIC_GIT_SHA: gitShaForBuild(),
  },
  async redirects() {
    return [{ source: '/legal.html', destination: '/legal', permanent: true }];
  },
  async headers() {
    return [
      {
        source: '/.well-known/nostr.json',
        headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
      },
    ];
  },
};

export default nextConfig;
