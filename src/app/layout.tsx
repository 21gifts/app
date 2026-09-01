import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { getRequestLocale } from '@/lib/request-locale';
import { getCatalog } from '@/lib/messages';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: '400 700',
  display: 'block',
  variable: '--font-outfit',
});

const description =
  'Direct human-to-human giving in Bitcoin. People helping people — no middleman, no cut.';

/**
 * Document-level metadata the App Router applies to every route's `<head>`,
 * including icons and the social-preview image.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://21.gifts'),
  title: '21.gifts',
  description,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '21.gifts',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://21.gifts',
    siteName: '21.gifts',
    title: '21.gifts',
    description,
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: '21.gifts — peer-to-peer Bitcoin gifts',
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
        alt: '21.gifts — peer-to-peer Bitcoin gifts',
      },
    ],
  },
};

/**
 * Root layout: the `<html>`/`<body>` shell shared by every page (locale, theme bootstrap, providers).
 *
 * @param props - Layout children.
 * @returns The document wrapper with negotiated `lang`, theme bootstrap, and locale messages.
 */
export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={outfit.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="bg-app-bg font-sans text-app-fg antialiased">
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <ThemeProvider>{children}</ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
