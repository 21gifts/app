import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { happylandPhotos } from '@/lib/happyland';
import { getCatalog } from '@/lib/messages';

it('ships eight distinct WebP assets with translated descriptions', () => {
  expect(new Set(happylandPhotos.map((photo) => photo.src)).size).toBe(8);
  for (const photo of happylandPhotos) {
    const bytes = readFileSync(`public${photo.src}`);
    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
    expect(photo.width).toBeGreaterThan(0);
    expect(photo.height).toBeGreaterThan(0);
    for (const locale of ['en', 'de', 'es', 'fil'] as const) {
      expect(getCatalog(locale)[photo.altKey].length).toBeGreaterThan(20);
      expect(getCatalog(locale)[photo.captionKey].trim()).not.toBe('');
    }
  }
});
