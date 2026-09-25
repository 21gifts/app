import { describe, expect, it } from 'vitest';
import { SHOP_STICKER_ELEMENTS } from '@/lib/shop-sticker-artwork';
import {
  SHOP_STICKER_PICTOGRAM,
  SHOP_STICKER_PICTOGRAM_VIEW_BOX,
} from '@/lib/shop-sticker-pictogram';

const BUILDING = 'M199.3 516.4L595.7 516.4';

/** viewBox half a stroke outside the pictogram ink, rounded to 0.1 sticker units. */
function framed(elements: readonly { d: string; stroke?: { width: number } }[]): string {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let stroke = 0;
  for (const el of elements) {
    const nums = el.d.match(/-?\d+(?:\.\d+)?/g);
    if (nums === null) {
      throw new Error('path has no coordinates');
    }
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    if (el.stroke !== undefined) {
      stroke = Math.max(stroke, el.stroke.width);
    }
  }
  const round = (n: number): string => String(Math.round(n * 10) / 10);
  return `${round(minX - stroke / 2)} ${round(minY - stroke / 2)} ${round(maxX - minX + stroke)} ${round(maxY - minY + stroke)}`;
}

describe('shop sticker pictogram', () => {
  it('is the storefront painted on the shop sticker, and nothing in front of it', () => {
    const start = SHOP_STICKER_ELEMENTS.findIndex((el) => el.d.startsWith(BUILDING));
    expect(start).toBeGreaterThan(0);
    expect(SHOP_STICKER_PICTOGRAM).toEqual(SHOP_STICKER_ELEMENTS.slice(start));
    expect(SHOP_STICKER_PICTOGRAM[0]?.d.startsWith(BUILDING)).toBe(true);
    expect(SHOP_STICKER_PICTOGRAM_VIEW_BOX).toBe(framed(SHOP_STICKER_PICTOGRAM));
  });
});
