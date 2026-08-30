// @vitest-environment node
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('manifest', () => {
  it('returns the installable web app manifest fields', () => {
    const value = manifest();
    expect(value.name).toBe('21.gifts');
    expect(value.short_name).toBe('21.gifts');
    expect(value.description).toBe(
      'Direct human-to-human giving in Bitcoin. People helping people — no middleman, no cut.',
    );
    expect(value.start_url).toBe('/welcome');
    expect(value.scope).toBe('/');
    expect(value.display).toBe('standalone');
    expect(value.background_color).toBe('#ffffff');
    expect(value.theme_color).toBe('#171717');
    expect(value.icons).toEqual([
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ]);
  });
});
