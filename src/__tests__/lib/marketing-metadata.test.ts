// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { marketingMetadata, OG_IMAGE_ALT } from '@/lib/marketing-metadata';

const TITLE = 'Help people with Bitcoin | 21.gifts';
const DESCRIPTION =
  "Read what people share, react to a post and donate Bitcoin directly to the person's wallet. 21.gifts does not hold your donation and keeps no share.";

describe('marketingMetadata', () => {
  it('keeps the English title, description, and preview when no locale is set', () => {
    const meta = marketingMetadata('/', TITLE, DESCRIPTION);
    expect(meta.title).toBe(TITLE);
    expect(meta.description).toBe(DESCRIPTION);
    expect(meta.alternates).toEqual({ canonical: '/' });
    expect(meta.openGraph).toMatchObject({
      title: TITLE,
      description: DESCRIPTION,
      url: '/',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: OG_IMAGE_ALT }],
    });
    expect(meta.twitter).toMatchObject({
      title: TITLE,
      description: DESCRIPTION,
      images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
    });
  });

  it('does not localize canonical or hreflang for a path outside the public pages', () => {
    const meta = marketingMetadata('/stats', TITLE, DESCRIPTION, 'de');
    expect(meta.alternates).toEqual({ canonical: '/stats' });
    expect(meta.openGraph).toMatchObject({
      url: '/stats',
      images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
    });
  });

  it('uses one English preview on every language URL and a language canonical', () => {
    const english = marketingMetadata('/about', TITLE, DESCRIPTION, 'en');
    const german = marketingMetadata('/about', TITLE, DESCRIPTION, 'de');
    const spanish = marketingMetadata('/about', TITLE, DESCRIPTION, 'es');
    for (const meta of [english, german, spanish]) {
      expect(meta.title).toBe(TITLE);
      expect(meta.description).toBe(DESCRIPTION);
      expect(meta.openGraph).toMatchObject({
        title: TITLE,
        description: DESCRIPTION,
        images: [{ url: '/og.png', width: 1200, height: 630, alt: OG_IMAGE_ALT }],
      });
      expect(meta.twitter).toEqual({
        card: 'summary_large_image',
        title: TITLE,
        description: DESCRIPTION,
        images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
      });
    }
    expect(english.alternates?.canonical).toBe('/en/about');
    expect(german.alternates?.canonical).toBe('/de/about');
    expect(spanish.alternates?.canonical).toBe('/es/about');
    expect(german.alternates).toMatchObject({
      languages: {
        en: '/en/about',
        de: '/de/about',
        es: '/es/about',
        fil: '/fil/about',
        'x-default': '/about',
      },
    });
    expect(german.openGraph).toMatchObject({ url: '/de/about' });
  });

  it('builds home, donate, and rules language URLs with the same English preview', () => {
    expect(marketingMetadata('/', TITLE, DESCRIPTION, 'fil').alternates?.canonical).toBe('/fil');
    expect(marketingMetadata('/donate', TITLE, DESCRIPTION, 'fil').alternates?.canonical).toBe(
      '/fil/donate',
    );
    expect(marketingMetadata('/rules', TITLE, DESCRIPTION, 'es').alternates?.canonical).toBe(
      '/es/rules',
    );
    expect(marketingMetadata('/', TITLE, DESCRIPTION, 'en').openGraph).toMatchObject({
      images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
    });
  });
});
