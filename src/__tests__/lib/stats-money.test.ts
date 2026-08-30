// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatBitcoin, formatUsdDisplay, formatUsdTick } from '@/lib/stats-money';

describe('formatUsdDisplay', () => {
  it('formats a two-decimal API string as en-US currency', () => {
    expect(formatUsdDisplay('1425.00')).toBe('$1,425.00');
  });

  it('keeps cents', () => {
    expect(formatUsdDisplay('1.50')).toBe('$1.50');
  });
});

describe('formatBitcoin', () => {
  it('formats zero', () => {
    expect(formatBitcoin(0)).toBe('₿0');
  });

  it('formats one', () => {
    expect(formatBitcoin(1)).toBe('₿1');
  });

  it('groups with en-US', () => {
    expect(formatBitcoin(1500, 'en-US')).toBe('₿1,500');
  });

  it('groups with de-DE via Intl', () => {
    expect(formatBitcoin(1500, 'de-DE')).toBe(`₿${new Intl.NumberFormat('de-DE').format(1500)}`);
  });
});

describe('formatUsdTick', () => {
  it('formats grouped dollars without cents', () => {
    expect(formatUsdTick(1425)).toBe('$1,425');
  });

  it('rounds fractional dollars for the axis', () => {
    expect(formatUsdTick(12.4)).toBe('$12');
  });

  it('keeps cents when the scale is under ten dollars', () => {
    expect(formatUsdTick(0)).toBe('$0');
    expect(formatUsdTick(1.43)).toBe('$1.43');
  });
});
