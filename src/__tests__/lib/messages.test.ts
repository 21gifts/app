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

  it('keeps every catalog value non-empty', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(getCatalog(locale))) {
        expect(value.length, `${locale}.${key}`).toBeGreaterThan(0);
      }
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
      expect(catalog['donate.errorAddress']).toContain('Wallet of Satoshi');
      expect(catalog['aria.github']).toBe('GitHub');
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, `${locale}.${key}`).not.toMatch(/Wallet-of-Satoshi/);
      }
    }
  });

  it('contains no Lightning or LNURL jargon in any catalog value', () => {
    const jargon = /Lightning|LNURL/i;
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, `${locale}.${key}`).not.toMatch(jargon);
      }
    }
  });

  it('prefixes home.step2BodyAfter with a period in every locale', () => {
    for (const locale of LOCALES) {
      expect(getCatalog(locale)['home.step2BodyAfter']).toMatch(/^\./);
    }
  });
});
