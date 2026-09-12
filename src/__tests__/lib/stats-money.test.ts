// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatGroupedNumber } from '@/lib/number-format';
import { formatBitcoin, formatUsdDisplay, formatUsdTick } from '@/lib/stats-money';

describe('formatUsdDisplay', () => {
  it('formats a two-decimal API string with Swiss grouping by default', () => {
    expect(formatUsdDisplay('1425.00')).toBe("$1'425.00");
  });

  it('keeps cents', () => {
    expect(formatUsdDisplay('1.50')).toBe('$1.50');
  });

  it('uses US and German separators when asked', () => {
    expect(formatUsdDisplay('10000.23', 'us')).toBe('$10,000.23');
    expect(formatUsdDisplay('23000.33', 'de')).toBe('$23.000,33');
    expect(formatUsdDisplay('1.50', 'de')).toBe('$1,50');
  });
});

describe('formatBitcoin', () => {
  it('formats zero', () => {
    expect(formatBitcoin(0)).toBe('₿0');
  });

  it('formats one', () => {
    expect(formatBitcoin(1)).toBe('₿1');
  });

  it('groups with Swiss apostrophes by default', () => {
    expect(formatBitcoin(1500)).toBe("₿1'500");
  });

  it('groups with US and German styles', () => {
    expect(formatBitcoin(1500, 'us')).toBe('₿1,500');
    expect(formatBitcoin(1500, 'de')).toBe('₿1.500');
  });
});

describe('formatUsdTick', () => {
  it('formats grouped dollars without cents', () => {
    expect(formatUsdTick(1425)).toBe("$1'425");
  });

  it('rounds fractional dollars for the axis', () => {
    expect(formatUsdTick(12.4)).toBe('$12');
  });

  it('keeps cents when the scale is under ten dollars', () => {
    expect(formatUsdTick(0)).toBe('$0');
    expect(formatUsdTick(1.43)).toBe('$1.43');
  });

  it('uses the style decimal separator under ten dollars', () => {
    expect(formatUsdTick(1.43, 'de')).toBe('$1,43');
    expect(formatUsdTick(1.5, 'de')).toBe('$1,5');
    expect(formatUsdTick(1425, 'de')).toBe('$1.425');
    expect(formatUsdTick(1425, 'us')).toBe('$1,425');
  });
});

describe('formatGroupedNumber samples', () => {
  it('locks the three visitor option samples', () => {
    expect(formatGroupedNumber(10000.23, 'ch', 2)).toBe("10'000.23");
    expect(formatGroupedNumber(10000.23, 'us', 2)).toBe('10,000.23');
    expect(formatGroupedNumber(23000.33, 'de', 2)).toBe('23.000,33');
  });
});
