import type { MetadataRoute } from 'next';

/**
 * Web App Manifest for installable 21.gifts (Add to Home Screen / install prompt).
 *
 * @returns The manifest Next.js serves at `/manifest.webmanifest`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '21.gifts',
    short_name: '21.gifts',
    description:
      'Direct human-to-human giving over Bitcoin. People helping people — no middleman, no cut.',
    start_url: '/welcome',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#171717',
    icons: [
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
