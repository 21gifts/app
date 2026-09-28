import { describe, expect, it } from 'vitest';
import { catalogs, getCatalog, type MessageKey } from '@/lib/messages';
import { translate } from '@/lib/translate';

describe('translate', () => {
  it('interpolates named placeholders', () => {
    expect(translate(getCatalog('en'), 'forum.payConfirm', { amount: '₿21' })).toBe('Pay ₿21');
  });

  it('throws when a placeholder is missing', () => {
    expect(() => translate(getCatalog('en'), 'forum.payConfirm', {})).toThrow(
      /Missing placeholder \{amount\}/,
    );
  });

  it('throws when vars are omitted but placeholders exist', () => {
    expect(() => translate(getCatalog('en'), 'forum.payConfirm')).toThrow(
      /Missing placeholder \{amount\}/,
    );
  });

  it('throws when the key is missing from the catalog', () => {
    expect(() => translate(getCatalog('en'), 'not.a.real.key' as MessageKey)).toThrow(
      /Missing message key/,
    );
  });

  it('pluralizes a count of one and every other count', () => {
    const en = getCatalog('en');
    const de = getCatalog('de');
    expect(translate(en, 'forum.replyCount', { count: 1 })).toBe('1 reaction');
    expect(translate(en, 'forum.replyCount', { count: '2' })).toBe('2 reactions');
    expect(translate(de, 'forum.replyCount', { count: 1 })).toBe('1 Reaktion');
    expect(translate(de, 'forum.replyCount', { count: '2' })).toBe('2 Reaktionen');
    expect(translate(en, 'funding.applications.openCount', { count: 1 })).toBe(
      'Open application (1)',
    );
    expect(translate(en, 'funding.applications.openCount', { count: '2' })).toBe(
      'Open applications (2)',
    );
    expect(translate(en, 'profile.postCount', { count: 1 })).toBe('1 post');
    expect(translate(en, 'profile.postCount', { count: 0 })).toBe('0 posts');
  });

  it('throws when a plural count is missing or not a finite number', () => {
    const en = getCatalog('en');
    expect(() => translate(en, 'forum.replyCount')).toThrow(/Missing placeholder \{count\}/);
    expect(() => translate(en, 'forum.replyCount', { count: 'nope' })).toThrow(
      /Missing placeholder \{count\}/,
    );
  });

  it('leaves a malformed plural template for the named-placeholder pass', () => {
    const en = getCatalog('en');
    const brokenHeader = {
      ...en,
      'forum.replyCount': 'before {count, plural, nope} after',
    } as typeof en;
    expect(translate(brokenHeader, 'forum.replyCount', { count: 1 })).toBe(
      'before {count, plural, nope} after',
    );
    const unclosed = {
      ...en,
      'forum.replyCount': '{count, plural, one {no close',
    } as typeof en;
    expect(translate(unclosed, 'forum.replyCount', { count: 1 })).toBe(
      '{count, plural, one {no close',
    );
    const noOther = {
      ...en,
      'forum.replyCount': '{count, plural, one {A} missing',
    } as typeof en;
    expect(translate(noOther, 'forum.replyCount', { count: 1 })).toBe(
      '{count, plural, one {A} missing',
    );
    const unclosedOther = {
      ...en,
      'forum.replyCount': '{count, plural, one {A} other {no close',
    } as typeof en;
    expect(translate(unclosedOther, 'forum.replyCount', { count: 1 })).toBe(
      '{count, plural, one {A} other {no close',
    );
    const extra = {
      ...en,
      'forum.replyCount': '{count, plural, one {A} other {B}X}',
    } as typeof en;
    expect(translate(extra, 'forum.replyCount', { count: 1 })).toBe(
      '{count, plural, one {A} other {B}X}',
    );
    const brace = {
      ...en,
      'forum.replyCount': '{count, plural, one {a { } other {c}}',
    } as typeof en;
    expect(translate(brace, 'forum.replyCount', { count: 2 })).toBe('c');
  });

  it('throws when a placeholder value is undefined', () => {
    expect(() =>
      translate(getCatalog('en'), 'forum.payConfirm', {
        amount: undefined as unknown as string,
      }),
    ).toThrow(/Missing placeholder \{amount\}/);
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
      if (template.includes('{count, plural,')) {
        expect(() => translate(en, key)).toThrow(/Missing placeholder \{count\}/);
        continue;
      }
      if (!/\{[A-Za-z_][A-Za-z0-9_]*\}/.test(template)) {
        expect(translate(en, key)).toBe(template);
      }
    }
  });
});
