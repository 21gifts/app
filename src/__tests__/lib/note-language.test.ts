import { describe, expect, it } from 'vitest';
import { detectNoteLanguage, shouldOfferNoteTranslate } from '@/lib/note-language';

describe('detectNoteLanguage', () => {
  it.each([
    'Thank you both — that helps.',
    'I can send a small gift tomorrow.',
    'Does anyone have spare sats this week?',
    'Hello from Ada',
    'Hello from Bob',
    'Hello from my profile note.',
    'Caption while the post is in flight.',
    'Caption waiting for the photo to load.',
    'Post to moderate',
    'Visible again note',
  ])('detects English fixture %j', (text) => {
    expect(detectNoteLanguage(text)).toBe('en');
  });

  it.each(['Hello team', 'Thank you!', 'Hello', 'A reply', 'hi', ''])(
    'returns null for short fixture %j',
    (text) => {
      expect(detectNoteLanguage(text)).toBeNull();
    },
  );

  it.each([
    ['Kann mir jemand diese Woche ein paar Satoshi leihen?', 'de'],
    ['Für uns ist das wirklich schön und nützlich', 'de'],
    ['¿Alguien tiene sats de sobra esta semana?', 'es'],
    ['May spare sats ba kayo ngayong linggo?', 'fil'],
    ['今週余ったサトシはありますか？', 'other'],
  ] as const)('detects %s as %s', (text, expected) => {
    expect(detectNoteLanguage(text)).toBe(expected);
  });

  it('strips URLs and Lightning invoices before deciding text is long enough', () => {
    expect(detectNoteLanguage('https://example.com/x')).toBeNull();
    expect(detectNoteLanguage('lnbc210n1exampleinvoice123')).toBeNull();
    expect(detectNoteLanguage('Thank you both https://example.com/x lnbc210n1invoice123')).toBe(
      'en',
    );
  });

  it('returns other when supported-language scores tie', () => {
    expect(detectNoteLanguage('This is para sa everyone')).toBe('other');
  });
});

describe('shouldOfferNoteTranslate', () => {
  it.each([
    'Thank you both — that helps.',
    'I can send a small gift tomorrow.',
    'Does anyone have spare sats this week?',
    'Hello from Ada',
    'Hello from Bob',
    'Hello from my profile note.',
    'Caption while the post is in flight.',
    'Caption waiting for the photo to load.',
    'Post to moderate',
    'Visible again note',
  ])('does not offer English fixture %j in the English UI', (text) => {
    expect(shouldOfferNoteTranslate(text, 'en')).toBe(false);
  });

  it('offers German in English but not in German', () => {
    const german = 'Kann mir jemand diese Woche ein paar Satoshi leihen?';
    expect(shouldOfferNoteTranslate(german, 'en')).toBe(true);
    expect(shouldOfferNoteTranslate(german, 'de')).toBe(false);
  });

  it('offers an unsupported language when the note is long enough', () => {
    expect(shouldOfferNoteTranslate('今週余ったサトシはありますか？', 'en')).toBe(true);
  });

  it('does not offer translation for text that is too short to detect', () => {
    expect(shouldOfferNoteTranslate('hi', 'en')).toBe(false);
  });
});
