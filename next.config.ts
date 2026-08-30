import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

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
  },
  async redirects() {
    return [{ source: '/legal.html', destination: '/legal', permanent: true }];
  },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (api === undefined || api === '') {
      return [];
    }
    return [
      {
        source: '/messages/:id/video.mp4',
        destination: `${api}/messages/:id/video.mp4`,
      },
      {
        source: '/messages/:id/video.webm',
        destination: `${api}/messages/:id/video.webm`,
      },
      {
        source: '/messages/:id/video.mov',
        destination: `${api}/messages/:id/video.mov`,
      },
    ];
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
