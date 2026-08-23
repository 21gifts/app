import { describe, expect, it } from 'vitest';
import { LOCALES } from '@/lib/locale';
import { catalogs, getCatalog } from '@/lib/messages';

describe('getCatalog', () => {
  it('keeps the same key set in every locale catalog', () => {
    const englishKeys = Object.keys(catalogs.en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(getCatalog(locale)).sort()).toEqual(englishKeys);
    }
  });

  it('returns a catalog for every supported locale', () => {
    for (const locale of LOCALES) {
      expect(typeof getCatalog(locale)['language.label']).toBe('string');
    }
  });

  it('keeps product tokens untranslated in every locale', () => {
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      expect(catalog['la.heading']).toBe('Wallet of Satoshi address');
      expect(catalog['donate.addressLabel']).toBe('Wallet of Satoshi address');
      expect(catalog['la.aria']).toBe('Wallet of Satoshi address');
      expect(catalog['aria.github']).toBe('GitHub');
    }
  });
});
