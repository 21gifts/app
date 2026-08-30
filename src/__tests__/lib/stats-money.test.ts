// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatBtcTick, formatSatTick, formatUsdDisplay, formatUsdTick } from '@/lib/stats-money';

describe('formatUsdDisplay', () => {
  it('formats a two-decimal API string as en-US currency', () => {
    expect(formatUsdDisplay('1425.00')).toBe('$1,425.00');
  });

  it('keeps cents', () => {
    expect(formatUsdDisplay('1.50')).toBe('$1.50');
  });
});

describe('formatBtcTick', () => {
  it('returns 0 for zero', () => {
    expect(formatBtcTick(0)).toBe('0');
  });

  it('trims trailing zeros up to 8 dp', () => {
    expect(formatBtcTick(0.015)).toBe('0.015');
    expect(formatBtcTick(0.0000001)).toBe('0.0000001');
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

describe('formatSatTick', () => {
  it('returns 0 for zero', () => {
    expect(formatSatTick(0)).toBe('0');
  });

  it('groups integers with en-US and no unit suffix', () => {
    expect(formatSatTick(1000)).toBe('1,000');
    expect(formatSatTick(1500)).toBe('1,500');
  });
});
