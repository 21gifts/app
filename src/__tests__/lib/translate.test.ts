import { describe, expect, it } from 'vitest';
import { catalogs, getCatalog, type MessageKey } from '@/lib/messages';
import { translate } from '@/lib/translate';

describe('translate', () => {
  it('interpolates named placeholders', () => {
    expect(translate(getCatalog('en'), 'forum.payConfirm', { amount: '21 sats' })).toBe(
      'Pay 21 sats',
    );
  });

  it('throws when a placeholder is missing', () => {
    expect(() => translate(getCatalog('en'), 'forum.payConfirm', {})).toThrow(
      /Missing placeholder \{amount\}/,
    );
  });

  it('throws when vars are omitted but placeholders exist', () => {
    expect(() => translate(getCatalog('en'), 'forum.sats')).toThrow(/Missing placeholder \{n\}/);
  });

  it('throws when the key is missing from the catalog', () => {
    expect(() => translate(getCatalog('en'), 'not.a.real.key' as MessageKey)).toThrow(
      /Missing message key/,
    );
  });

  it('throws when a placeholder value is undefined', () => {
    expect(() =>
      translate(getCatalog('en'), 'forum.sats', {
        n: undefined as unknown as number,
      }),
    ).toThrow(/Missing placeholder \{n\}/);
  });
});

describe('catalogs', () => {
  it('keeps identical key sets across locales', () => {
    const enKeys = Object.keys(catalogs.en).sort();
    for (const locale of ['de', 'es', 'fil'] as const) {
      expect(Object.keys(getCatalog(locale)).sort()).toEqual(enKeys);
    }
  });

  it('resolves every English key without throwing', () => {
    const en = getCatalog('en');
    for (const key of Object.keys(en) as MessageKey[]) {
      const template = en[key];
      if (template === undefined) {
        throw new Error(`Missing English template for ${key}`);
      }
      if (!/\{[A-Za-z_][A-Za-z0-9_]*\}/.test(template)) {
        expect(translate(en, key)).toBe(template);
      }
    }
  });
});
