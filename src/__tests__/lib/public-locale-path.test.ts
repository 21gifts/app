import { describe, expect, it } from 'vitest';
import {
  localizedPublicPath,
  parseLocalizedPublicPath,
  publicPathFromUrl,
} from '@/lib/public-locale-path';

describe('public locale paths', () => {
  it('builds one stable path per supported language and public screen', () => {
    expect(localizedPublicPath('de', '/')).toBe('/de');
    expect(localizedPublicPath('fil', '/donate')).toBe('/fil/donate');
  });

  it('accepts only complete public language paths', () => {
    expect(parseLocalizedPublicPath('/es/about')).toEqual({ locale: 'es', path: '/about' });
    expect(parseLocalizedPublicPath('/es/login')).toBeNull();
    expect(parseLocalizedPublicPath('/fr/about')).toBeNull();
    expect(parseLocalizedPublicPath('/es/about/extra')).toBeNull();
  });

  it('keeps the same page when switching from a legacy or localized URL', () => {
    expect(publicPathFromUrl('/rules')).toBe('/rules');
    expect(publicPathFromUrl('/de/rules')).toBe('/rules');
    expect(publicPathFromUrl('/login')).toBeNull();
  });
});
