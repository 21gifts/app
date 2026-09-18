import { describe, expect, it } from 'vitest';
import { isInternalAppUrl, splitNoteLinks } from '@/lib/note-links';

describe('isInternalAppUrl', () => {
  it('returns true for 21.gifts and www.21.gifts', () => {
    expect(isInternalAppUrl('http://21.gifts/trust-chain')).toBe(true);
    expect(isInternalAppUrl('https://WWW.21.gifts/welcome')).toBe(true);
    expect(isInternalAppUrl('https://21.gifts./welcome')).toBe(true);
  });

  it('returns false for other hosts and bad hrefs', () => {
    expect(isInternalAppUrl('https://example.com/phish')).toBe(false);
    expect(isInternalAppUrl('https://api.21.gifts/me')).toBe(false);
    expect(isInternalAppUrl('https://dev-api.21.gifts/me')).toBe(false);
    expect(isInternalAppUrl('https://21.gifts.evil.com/')).toBe(false);
    expect(isInternalAppUrl('https://21.gifts@evil.com/')).toBe(false);
    expect(isInternalAppUrl('javascript:alert(1)')).toBe(false);
    expect(isInternalAppUrl('ftp://21.gifts/file')).toBe(false);
    expect(isInternalAppUrl('not a url')).toBe(false);
  });

  it('treats the current origin hostname as internal', () => {
    expect(isInternalAppUrl('http://localhost:3000/trust-chain', 'http://localhost:3000')).toBe(
      true,
    );
    expect(isInternalAppUrl('http://localhost:3000/trust-chain', 'https://21.gifts')).toBe(false);
    expect(isInternalAppUrl('https://example.com/', 'not a origin')).toBe(false);
    expect(isInternalAppUrl('https://example.com/', '')).toBe(false);
  });
});

describe('splitNoteLinks', () => {
  it('returns no segments for empty text and plain text without urls', () => {
    expect(splitNoteLinks('')).toEqual([]);
    expect(splitNoteLinks('just a note')).toEqual([{ kind: 'text', value: 'just a note' }]);
    expect(splitNoteLinks('javascript:alert(1)')).toEqual([
      { kind: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('splits http and https urls and strips trailing punctuation', () => {
    expect(splitNoteLinks('see https://example.com/phish.')).toEqual([
      { kind: 'text', value: 'see ' },
      {
        kind: 'url',
        href: 'https://example.com/phish',
        value: 'https://example.com/phish',
        internal: false,
        path: '/phish',
      },
      { kind: 'text', value: '.' },
    ]);
    expect(splitNoteLinks('go http://21.gifts/trust-chain)')).toEqual([
      { kind: 'text', value: 'go ' },
      {
        kind: 'url',
        href: 'http://21.gifts/trust-chain',
        value: 'http://21.gifts/trust-chain',
        internal: true,
        path: '/trust-chain',
      },
      { kind: 'text', value: ')' },
    ]);
  });

  it('collapses extra leading slashes so internal hrefs stay same-origin', () => {
    expect(splitNoteLinks('https://21.gifts//evil.com')).toEqual([
      {
        kind: 'url',
        href: 'https://21.gifts//evil.com',
        value: 'https://21.gifts//evil.com',
        internal: true,
        path: '/evil.com',
      },
    ]);
  });

  it('keeps query and hash on the path', () => {
    const href = 'https://21.gifts/welcome?tab=all#top';
    expect(splitNoteLinks(`open ${href}`)).toEqual([
      { kind: 'text', value: 'open ' },
      {
        kind: 'url',
        href,
        value: href,
        internal: true,
        path: '/welcome?tab=all#top',
      },
    ]);
  });

  it('classifies www as internal and api as external', () => {
    expect(splitNoteLinks('https://www.21.gifts/')).toEqual([
      {
        kind: 'url',
        href: 'https://www.21.gifts/',
        value: 'https://www.21.gifts/',
        internal: true,
        path: '/',
      },
    ]);
    expect(splitNoteLinks('https://api.21.gifts/me')).toEqual([
      {
        kind: 'url',
        href: 'https://api.21.gifts/me',
        value: 'https://api.21.gifts/me',
        internal: false,
        path: '/me',
      },
    ]);
  });

  it('uses currentOrigin for localhost and leaves production localhost external', () => {
    const local = 'http://localhost:3000/trust-chain';
    expect(splitNoteLinks(local, 'http://localhost:3000')).toEqual([
      {
        kind: 'url',
        href: 'http://localhost:3000/trust-chain',
        value: local,
        internal: true,
        path: '/trust-chain',
      },
    ]);
    expect(splitNoteLinks(local, 'https://21.gifts')).toEqual([
      {
        kind: 'url',
        href: 'http://localhost:3000/trust-chain',
        value: local,
        internal: false,
        path: '/trust-chain',
      },
    ]);
    expect(splitNoteLinks('https://example.com/', '')[0]).toMatchObject({ internal: false });
  });

  it('splits two urls with surrounding text', () => {
    const text = 'a https://example.com/x and http://21.gifts/y b';
    const segments = splitNoteLinks(text);
    expect(segments.map((segment) => segment.kind)).toEqual(['text', 'url', 'text', 'url', 'text']);
    expect(segments[1]).toMatchObject({ internal: false, path: '/x' });
    expect(segments[3]).toMatchObject({ internal: true, path: '/y' });
  });

  it('leaves an unparseable http prefix as text', () => {
    const text = 'see http://';
    expect(splitNoteLinks(text)).toEqual([{ kind: 'text', value: text }]);
    expect(splitNoteLinks('see http://%')).toEqual([{ kind: 'text', value: 'see http://%' }]);
  });

  it('treats userinfo on another host as external', () => {
    const value = 'https://21.gifts@evil.com/';
    const segments = splitNoteLinks(value);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('url');
    if (segments[0]?.kind === 'url') {
      expect(segments[0].internal).toBe(false);
      expect(segments[0].href).toContain('evil.com');
    }
  });
});
