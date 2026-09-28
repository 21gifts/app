import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/lib/locale';
import { localizedPublicPath, type LocalizedPublicPath } from '@/lib/public-locale-path';

/** Keep search and social previews aligned with the visible marketing page. */
export function marketingMetadata(
  path: string,
  title: string,
  description: string,
  locale?: Locale,
): Metadata {
  const image = {
    url: locale === undefined || locale === 'en' ? '/og.png' : `/og-${locale}.png`,
    width: 1200,
    height: 630,
    alt: title,
  };
  const localized = locale !== undefined && ['/', '/about', '/donate', '/rules'].includes(path);
  const canonical = localized ? localizedPublicPath(locale, path as LocalizedPublicPath) : path;
  const languages = localized
    ? {
        ...Object.fromEntries(
          LOCALES.map((code) => [code, localizedPublicPath(code, path as LocalizedPublicPath)]),
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
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
