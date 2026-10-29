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

  it('keeps the shop-count plural copy in every catalog', () => {
    expect(getCatalog('en')['profile.shopCount']).toBe(
      '{count, plural, one {# shop} other {# shops}}',
    );
    expect(getCatalog('de')['profile.shopCount']).toBe(
      '{count, plural, one {# Shop} other {# Shops}}',
    );
    expect(getCatalog('es')['profile.shopCount']).toBe(
      '{count, plural, one {# tienda} other {# tiendas}}',
    );
    expect(getCatalog('fil')['profile.shopCount']).toBe(
      '{count, plural, one {# tindahan} other {# tindahan}}',
    );
  });

  it('keeps the credit-count plural copy in every catalog', () => {
    expect(getCatalog('en')['profile.creditCount']).toBe(
      '{count, plural, one {# credit} other {# credits}}',
    );
    expect(getCatalog('de')['profile.creditCount']).toBe(
      '{count, plural, one {# Kredit} other {# Kredite}}',
    );
    expect(getCatalog('es')['profile.creditCount']).toBe(
      '{count, plural, one {# crédito} other {# créditos}}',
    );
    expect(getCatalog('fil')['profile.creditCount']).toBe(
      '{count, plural, one {# utang} other {# utang}}',
    );
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

  it('contains no Lightning, LNURL, or Spark jargon in any catalog value', () => {
    const jargon = /Lightning|LNURL|\bSpark\b/i;
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      for (const [key, value] of Object.entries(catalog)) {
        expect(value, `${locale}.${key}`).not.toMatch(jargon);
      }
    }
  });

  it('names no wallet key in the privacy answer of any locale', () => {
    for (const locale of LOCALES) {
      expect(getCatalog(locale)['home.faq3A'], `${locale}.home.faq3A`).not.toMatch(
        /public key|Schlüssel|clave/i,
      );
    }
  });

  it('says the @21.gifts address ends with the service while the 12 words keep the Bitcoin', () => {
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale);
      for (const key of ['about.conv2Body', 'home.why3Body'] as const) {
        expect(catalog[key], `${locale}.${key}`).toContain('@21.gifts');
        expect(catalog[key], `${locale}.${key}`).toContain('12');
      }
    }
    expect(getCatalog('en')['about.conv2Body']).toContain('address would stop working');
  });

  it('answers in the home FAQ that a lost passkey can be recovered with the words or Social Recovery', () => {
    expect(getCatalog('en')['home.faq4A']).not.toMatch(/cannot be recovered/);
    expect(getCatalog('de')['home.faq4A']).not.toMatch(/nicht wiederherstellen/);
    expect(getCatalog('es')['home.faq4A']).not.toMatch(/no se puede recuperar/);
    expect(getCatalog('fil')['home.faq4A']).not.toMatch(/hindi pa mababawi/);
    for (const locale of LOCALES) {
      const answer = getCatalog(locale)['home.faq4A'];
      expect(answer, `${locale}.home.faq4A`).toContain('Social Recovery');
      expect(answer, `${locale}.home.faq4A`).toContain('12');
    }
  });

  it('warns under the 12 words that they take over the whole account', () => {
    for (const locale of LOCALES) {
      const catalog = getCatalog(locale) as Record<string, string>;
      expect(catalog['wallet.onlyBackup'], `${locale}.wallet.onlyBackup`).toBeUndefined();
      expect(catalog['wallet.phraseWarning'], `${locale}.wallet.phraseWarning`).toContain('12');
    }
    expect(getCatalog('en')['wallet.phraseWarning']).toContain('whole account');
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
