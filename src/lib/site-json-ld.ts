export const SITE_DESCRIPTION =
  'Direct human-to-human giving in Bitcoin. People helping people — no middleman.';

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
      description: SITE_DESCRIPTION,
      publisher: { '@id': 'https://21.gifts/#organization' },
      inLanguage: ['en', 'de', 'es', 'fil'],
    },
  ],
} as const;
