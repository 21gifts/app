import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import type { ReactElement, ReactNode } from 'react';
import { Suspense } from 'react';
import { AppHeightSync } from '@/components/AppHeightSync';
import { AccountPreferenceSync } from '@/components/AccountPreferenceSync';
import { LocaleProvider } from '@/components/LocaleProvider';
import { FiatPreferenceProvider } from '@/components/FiatPreferenceProvider';
import { NumberFormatProvider } from '@/components/NumberFormatProvider';
import { RememberWalletReturn } from '@/components/RememberWalletReturn';
import { ThemeProvider } from '@/components/ThemeProvider';
import { APP_HEIGHT_BOOTSTRAP_SCRIPT } from '@/lib/app-height';
import { getRequestFiat } from '@/lib/request-fiat';
import { getRequestLocale } from '@/lib/request-locale';
import { getRequestNumberFormat } from '@/lib/request-number-format';
import { getCatalog } from '@/lib/messages';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  weight: 'variable',
  display: 'block',
  variable: '--font-outfit',
});

const description =
  'Direct human-to-human giving in Bitcoin. People helping people — no middleman.';
const title = '21.gifts — peer-to-peer Bitcoin gifts';

/**
 * Document-level metadata the App Router applies to every route's `<head>`,
 * including icons and the social-preview image.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://21.gifts'),
  title,
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
    title,
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
    title,
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
 * Organization and WebSite JSON-LD injected into every route's `<head>`.
 */
export const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://21.gifts/#organization',
      name: '21.gifts',
      alternateName: ['21gifts'],
      url: 'https://21.gifts/',
      logo: 'https://21.gifts/favicon.svg',
      sameAs: ['https://github.com/21gifts'],
    },
    {
      '@type': 'WebSite',
      '@id': 'https://21.gifts/#website',
      name: '21.gifts',
      alternateName: ['21gifts'],
      url: 'https://21.gifts/',
      description,
      publisher: { '@id': 'https://21.gifts/#organization' },
      inLanguage: ['en', 'de', 'es', 'fil'],
    },
  ],
} as const;

/**
 * Root viewport: device-width at scale 1. Form controls use 16px type so
 * iOS Safari does not auto-zoom on focus. Pinch-zoom stays available (WCAG 1.4.4).
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Root layout: the `<html>`/`<body>` shell shared by every page (locale, number
 * format, fiat preference, theme bootstrap, providers).
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
  const numberFormat = await getRequestNumberFormat();
  const fiat = await getRequestFiat(locale);
  return (
    <html lang={locale} suppressHydrationWarning className={outfit.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_HEIGHT_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(SITE_JSON_LD).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="bg-app-bg font-sans text-app-fg antialiased">
        <AppHeightSync />
        <LocaleProvider locale={locale} messages={getCatalog(locale)}>
          <NumberFormatProvider initial={numberFormat}>
            <FiatPreferenceProvider initial={fiat}>
              <ThemeProvider>
                <AccountPreferenceSync />
                <Suspense fallback={null}>
                  <RememberWalletReturn />
                </Suspense>
                {children}
              </ThemeProvider>
            </FiatPreferenceProvider>
          </NumberFormatProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
