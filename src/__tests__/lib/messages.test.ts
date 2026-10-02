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
    expect(getCatalog('en')['forum.react']).toBe('React');
    expect(getCatalog('de')['forum.react']).toBe('Reagieren');
    expect(getCatalog('es')['forum.react']).toBe('Reaccionar');
    expect(getCatalog('fil')['forum.react']).toBe('Tumugon');
    expect(getCatalog('en')['forum.hiddenNotice']).toBe(
      'This note was hidden by {name} on {time}.',
    );
    expect(getCatalog('de')['forum.hiddenNotice']).toBe(
      'Diese Notiz wurde von {name} am {time} ausgeblendet.',
    );
    expect(getCatalog('es')['forum.hiddenNotice']).toBe(
      'Esta nota fue ocultada por {name} el {time}.',
    );
    expect(getCatalog('fil')['forum.hiddenNotice']).toBe(
      'Itinago ni {name} ang notang ito noong {time}.',
    );
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      expect(catalog['forum.payOpenWalletAria']).toContain('Bitcoin');
      expect(catalog['forum.payOpenWalletAria'].trim().length).toBeGreaterThan(0);
      expect(catalog['home.faq8A']).toContain('Bitcoin');
      expect(catalog['aria.github']).toBe('GitHub');
    }
  });

  it('names no third-party wallet app in any catalog value', () => {
    const thirdPartyWallet = new RegExp(['wallet', 'of', 'satoshi'].join('[\\s-]*'), 'i');
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(getCatalog(locale))) {
        expect(value, `${locale}.${key}`).not.toMatch(thirdPartyWallet);
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

  it('contains no visitor-facing sats unit except home.faq8A', () => {
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      for (const [key, value] of Object.entries(catalog)) {
        if (key === 'home.faq8A') {
          continue;
        }
        expect(value, `${locale}.${key}`).not.toMatch(/\b[Ss]ats?\b/);
      }
    }
  });
});
