import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/lib/locale';
import { localizedPublicPath, type LocalizedPublicPath } from '@/lib/public-locale-path';

/**
 * English alt text for the shared 1200×630 social preview on every URL.
 */
export const OG_IMAGE_ALT = '21.gifts: Help people. With Bitcoin. Your wallet to their wallet.';

/**
 * `hreflang` code for each UI locale.
 *
 * Google Search accepts only ISO 639-1 language codes in `hreflang`
 * ("Only language codes listed in ISO 639-1 are supported"). Filipino's
 * UI locale, URL prefix, `html lang`, cookie, and catalogs stay `fil`.
 * Google lists Filipino as `tl`, so Filipino alternates use that code.
 * The linked URL stays `/fil…`.
 */
export const HREFLANG_BY_LOCALE = {
  en: 'en',
  de: 'de',
  es: 'es',
  fil: 'tl',
} as const satisfies Record<Locale, string>;

const OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: OG_IMAGE_ALT,
} as const;

/**
 * Search and social metadata for a public page.
 *
 * Title, description, and the Open Graph image stay the English values the
 * caller passes, on every language URL. When `locale` is set and `path` is
 * `/`, `/about`, `/donate`, or `/rules`, the canonical URL and reciprocal
 * `hreflang` links follow that language. Filipino alternates use `tl`
 * ({@link HREFLANG_BY_LOCALE}); the URL stays `/fil…`. Other paths keep
 * `path` as the canonical URL.
 *
 * @param path - Unprefixed path, for example `/` or `/about`.
 * @param title - English document title. Used unchanged.
 * @param description - English document description. Used unchanged.
 * @param locale - Language of the URL, when the page has a language prefix.
 * @returns Next.js metadata. No I/O.
 */
export function marketingMetadata(
  path: string,
  title: string,
  description: string,
  locale?: Locale,
): Metadata {
  const localized = locale !== undefined && ['/', '/about', '/donate', '/rules'].includes(path);
  const canonical = localized ? localizedPublicPath(locale, path as LocalizedPublicPath) : path;
  const languages = localized
    ? {
        ...Object.fromEntries(
          LOCALES.map((code) => [
            HREFLANG_BY_LOCALE[code],
            localizedPublicPath(code, path as LocalizedPublicPath),
          ]),
        ),
        'x-default': path,
      }
    : undefined;
  return {
    title,
    description,
    alternates: { canonical, ...(languages !== undefined ? { languages } : {}) },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: '21.gifts',
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}
