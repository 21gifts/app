import { describe, expect, it } from 'vitest';
import { parseAcceptLanguage } from '@/lib/locale';

describe('parseAcceptLanguage', () => {
  it('defaults empty and garbage headers to en', () => {
    expect(parseAcceptLanguage('')).toBe('en');
    expect(parseAcceptLanguage('   ')).toBe('en');
    expect(parseAcceptLanguage('@@@')).toBe('en');
  });

  it('maps de-CH to de', () => {
    expect(parseAcceptLanguage('de-CH,de;q=0.9')).toBe('de');
  });

  it('maps es-MX ahead of en', () => {
    expect(parseAcceptLanguage('es-MX,es;q=0.8,en;q=0.5')).toBe('es');
  });

  it('maps fil-PH to fil', () => {
    expect(parseAcceptLanguage('fil-PH')).toBe('fil');
  });

  it('maps tl to fil', () => {
    expect(parseAcceptLanguage('tl-PH,tl;q=0.9')).toBe('fil');
  });

  it('prefers en over later tl (typical PH header)', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.9,tl;q=0.8')).toBe('en');
  });

  it('falls back to en for unmatched languages', () => {
    expect(parseAcceptLanguage('fr-FR,fr;q=0.9')).toBe('en');
  });

  it('honours q-order so de beats a lower-q tl', () => {
    expect(parseAcceptLanguage('tl;q=0.2,de;q=0.8')).toBe('de');
    expect(parseAcceptLanguage('de;q=0.5,de;q=0.9')).toBe('de');
  });

  it('skips empty tags and empty primary subtags', () => {
    expect(parseAcceptLanguage(',de')).toBe('de');
    expect(parseAcceptLanguage(';q=1,de')).toBe('de');
    expect(parseAcceptLanguage('-,de')).toBe('de');
    expect(parseAcceptLanguage('de--CH,en;q=0.5')).toBe('en');
  });

  it('keeps header order when q-values are equal', () => {
    expect(parseAcceptLanguage('es;q=0.9,de;q=0.9')).toBe('es');
  });

  it('skips tags with q=0 as not acceptable', () => {
    expect(parseAcceptLanguage('en;q=0,de')).toBe('de');
    expect(parseAcceptLanguage('en;q=0')).toBe('en');
    expect(parseAcceptLanguage('de;q=0,fr;q=0')).toBe('en');
  });

  it('discards language-ranges with invalid q values', () => {
    expect(parseAcceptLanguage('de;q=-1,en;q=0.5')).toBe('en');
    expect(parseAcceptLanguage('de;q=2,en;q=0.5')).toBe('en');
    expect(parseAcceptLanguage('de;q=foo,en;q=0.5')).toBe('en');
    expect(parseAcceptLanguage('de;q=0.5oops,en;q=0.4')).toBe('en');
    expect(parseAcceptLanguage('de;q=,en;q=0.4')).toBe('en');
  });

  it('honours wildcard * with q=0 exclusion and LOCALES order', () => {
    expect(parseAcceptLanguage('en;q=0,*;q=1')).toBe('de');
    expect(parseAcceptLanguage('*;q=1,de;q=0.5')).toBe('en');
    expect(parseAcceptLanguage('*')).toBe('en');
    expect(parseAcceptLanguage('*;q=0')).toBe('en');
    expect(parseAcceptLanguage('*;q=0.5,*;q=1')).toBe('en');
  });

  it('rejects invalid Basic Language Ranges', () => {
    expect(parseAcceptLanguage('de-@@@,en;q=0.5')).toBe('en');
    expect(parseAcceptLanguage('de-ä,en;q=0.5')).toBe('en');
  });
});
