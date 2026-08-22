import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

const description =
  'Direct human-to-human giving over Bitcoin Lightning. People helping people — no middleman, no cut.';

/**
 * Document-level metadata the App Router applies to every route's `<head>`,
 * including icons and the social-preview image.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://app.21.gifts'),
  title: '21.gifts',
  description,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://app.21.gifts',
    siteName: '21.gifts',
    title: '21.gifts',
    description,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '21.gifts — peer-to-peer Bitcoin Lightning gifts',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '21.gifts',
    description,
    images: [
      {
        url: '/og.png',
        alt: '21.gifts — peer-to-peer Bitcoin Lightning gifts',
      },
    ],
  },
};

/**
 * Root layout: the `<html>`/`<body>` shell shared by every page.
 */
export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
