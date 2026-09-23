import { describe, expect, it } from 'vitest';
import {
  SHOP_STICKER_COLORS,
  SHOP_STICKER_ELEMENTS,
  SHOP_STICKER_HEIGHT,
  SHOP_STICKER_MARK,
  SHOP_STICKER_QR_BOX,
  SHOP_STICKER_WIDTH,
} from '@/lib/shop-sticker-artwork';

const ONLY_ABSOLUTE_MLCZ = /^(?:[MLCZ](?:-?\d*\.?\d+(?: -?\d*\.?\d+)*)?)+$/;

describe('shop sticker artwork', () => {
  it('uses only the three sticker colours', () => {
    const palette = new Set<string>(Object.values(SHOP_STICKER_COLORS));
    expect([...palette].sort()).toEqual(['#000000', '#F99602', '#FFFFFF']);
    for (const el of SHOP_STICKER_ELEMENTS) {
      if (el.fill !== undefined) expect(palette.has(el.fill)).toBe(true);
      if (el.stroke !== undefined) expect(palette.has(el.stroke.color)).toBe(true);
    }
  });

  it('writes every path with absolute M, L, C and Z only', () => {
    for (const el of SHOP_STICKER_ELEMENTS) expect(el.d).toMatch(ONLY_ABSOLUTE_MLCZ);
    expect(SHOP_STICKER_MARK).toMatch(ONLY_ABSOLUTE_MLCZ);
  });

  it('starts with the white paper and the full-width orange band', () => {
    expect(SHOP_STICKER_ELEMENTS[0]).toEqual({ d: 'M0 0L1500 0L1500 918L0 918Z', fill: '#FFFFFF' });
    expect(SHOP_STICKER_ELEMENTS[1]).toEqual({ d: 'M0 0L1500 0L1500 332L0 332Z', fill: '#F99602' });
  });

  it('keeps the QR box inside the artwork, 4 modules below the band, ending at the bottom margin', () => {
    const { x, y, size } = SHOP_STICKER_QR_BOX;
    expect(x).toBeGreaterThan(SHOP_STICKER_WIDTH / 2);
    expect(x + size).toBeLessThan(SHOP_STICKER_WIDTH);
    expect(y - 332).toBeCloseTo((4 * size) / 57, 3);
    expect(y + size).toBeCloseTo(SHOP_STICKER_HEIGHT - 53, 3);
  });
});
