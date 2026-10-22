import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCALE_COOKIE } from '@/lib/locale';
import { readLocaleCookie, writeLocaleCookie } from '@/lib/locale-cookie';

function cookieAttributes(code: string, secure: boolean): string {
  const suffix = secure ? '; Secure' : '';
  return `${LOCALE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax${suffix}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
  document.cookie = 'theme=; Path=/; Max-Age=0';
});

describe('writeLocaleCookie', () => {
  it('omits Secure on http', () => {
    const set = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      writeLocaleCookie('de');
      expect(set).toHaveBeenCalledWith(cookieAttributes('de', false));
    } finally {
      vi.unstubAllGlobals();
      if (previous !== undefined) {
        Object.defineProperty(document, 'cookie', previous);
      }
    }
  });

  it('adds Secure on https', () => {
    const set = vi.fn();
    const previous = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set,
    });
    vi.stubGlobal('location', { protocol: 'https:' });
    try {
      writeLocaleCookie('es');
      expect(set).toHaveBeenCalledWith(cookieAttributes('es', true));
    } finally {
      vi.unstubAllGlobals();
      if (previous !== undefined) {
        Object.defineProperty(document, 'cookie', previous);
      }
    }
  });
});

describe('readLocaleCookie', () => {
  it('returns null when the cookie is absent', () => {
    document.cookie = 'theme=dark; Path=/';
    expect(readLocaleCookie()).toBeNull();
  });

  it('returns the supported locale when the cookie is first or follows another', () => {
    document.cookie = `${LOCALE_COOKIE}=de; Path=/`;
    expect(readLocaleCookie()).toBe('de');
    document.cookie = 'theme=dark; Path=/';
    document.cookie = `${LOCALE_COOKIE}=fil; Path=/`;
    expect(readLocaleCookie()).toBe('fil');
  });

  it('returns null for an unsupported value', () => {
    document.cookie = `${LOCALE_COOKIE}=en-US; Path=/`;
    expect(readLocaleCookie()).toBeNull();
    document.cookie = `${LOCALE_COOKIE}=tl; Path=/`;
    expect(readLocaleCookie()).toBeNull();
  });
});
