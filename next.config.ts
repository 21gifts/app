import type { NextConfig } from 'next';

/**
 * `output: 'standalone'` makes `next build` emit a self-contained server
 * under `.next/standalone` — that is what the Dockerfile runtime stage ships.
 * No other options are set; defaults stay visible as defaults.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
