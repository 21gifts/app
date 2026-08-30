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
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('returns a catalog for every supported locale', () => {
    for (const locale of LOCALES) {
      expect(typeof getCatalog(locale)['language.label']).toBe('string');
    }
  });

  it('keeps product tokens untranslated in every locale', () => {
    expect(getCatalog('en')['forum.payOpenWallet']).toBe('Pay');
    expect(getCatalog('de')['forum.payOpenWallet']).toBe('Zahlen');
    expect(getCatalog('es')['forum.payOpenWallet']).toBe('Pagar');
    expect(getCatalog('fil')['forum.payOpenWallet']).toBe('Magbayad');
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      expect(catalog['la.heading']).toBe('Wallet of Satoshi address');
      expect(catalog['la.aria']).toBe('Wallet of Satoshi address');
      expect(catalog['forum.payOpenWalletAria']).toContain('Wallet of Satoshi');
      expect(catalog['forum.payOpenWalletAria'].trim().length).toBeGreaterThan(0);
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

  it('contains no visitor-facing sats unit except Wallet of Satoshi and home.faq8A', () => {
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      for (const [key, value] of Object.entries(catalog)) {
        if (key === 'home.faq8A') {
          continue;
        }
        const withoutProduct = value.replaceAll('Wallet of Satoshi', '');
        expect(withoutProduct, `${locale}.${key}`).not.toMatch(/\b[Ss]ats?\b/);
      }
    }
  });
});
