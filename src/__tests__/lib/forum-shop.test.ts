import { describe, expect, it } from 'vitest';
import { ensureShopHashtag, isShopNote, stripShopHashtag } from '@/lib/forum-shop';

describe('forum-shop', () => {
  describe('isShopNote', () => {
    it('is true for #21GiftsShop in any case and with surrounding text', () => {
      expect(isShopNote('#21GiftsShop')).toBe(true);
      expect(isShopNote('#21giftsshop')).toBe(true);
      expect(isShopNote('Hello\n\n#21GiftsShop')).toBe(true);
      expect(isShopNote('x #21GiftsShop!')).toBe(true);
    });

    it('is false for empty text, prefixes, longer tags, and the site URL', () => {
      expect(isShopNote('')).toBe(false);
      expect(isShopNote('#21gifts')).toBe(false);
      expect(isShopNote('#21GiftsShopping')).toBe(false);
      expect(isShopNote('https://21.gifts')).toBe(false);
    });
  });

  describe('stripShopHashtag', () => {
    it('returns empty when only the hashtag is present', () => {
      expect(stripShopHashtag('#21GiftsShop')).toBe('');
    });

    it('removes a trailing shop hashtag and leftover blank lines', () => {
      expect(stripShopHashtag('Cafe Luna\n\n#21GiftsShop')).toBe('Cafe Luna');
    });

    it('does not collapse unrelated double spaces in the body', () => {
      expect(stripShopHashtag('Open  daily\n\n#21GiftsShop')).toBe('Open  daily');
    });
  });

  describe('ensureShopHashtag', () => {
    it('appends the shop hashtag to untagged text', () => {
      expect(ensureShopHashtag('Cafe Luna')).toBe('Cafe Luna\n\n#21GiftsShop');
    });

    it('does not duplicate when the hashtag is already present', () => {
      expect(ensureShopHashtag('Cafe Luna\n\n#21GiftsShop')).toBe('Cafe Luna\n\n#21GiftsShop');
    });

    it('returns only the hashtag for empty text', () => {
      expect(ensureShopHashtag('')).toBe('#21GiftsShop');
    });

    it('appends the hashtag even when the body is 8000 characters', () => {
      expect(ensureShopHashtag('a'.repeat(8000)).length).toBeGreaterThan(8000);
    });
  });
});
