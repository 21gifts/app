// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUMBER_FORMAT,
  NUMBER_FORMAT_COOKIE,
  NUMBER_FORMATS,
  formatGroupedNumber,
  parseNumberFormat,
  separatorsFor,
} from '@/lib/number-format';

describe('constants', () => {
  it('lists Swiss first then US then German', () => {
    expect(NUMBER_FORMATS).toEqual(['ch', 'us', 'de']);
    expect(DEFAULT_NUMBER_FORMAT).toBe('ch');
    expect(NUMBER_FORMAT_COOKIE).toBe('numberFormat');
  });
});

describe('parseNumberFormat', () => {
  it('accepts exact ch us de', () => {
    expect(parseNumberFormat('ch')).toBe('ch');
    expect(parseNumberFormat('us')).toBe('us');
    expect(parseNumberFormat('de')).toBe('de');
  });

  it('defaults missing, empty, and invalid values to ch', () => {
    expect(parseNumberFormat(undefined)).toBe('ch');
    expect(parseNumberFormat('')).toBe('ch');
    expect(parseNumberFormat('CH')).toBe('ch');
    expect(parseNumberFormat('de-CH')).toBe('ch');
    expect(parseNumberFormat('xx')).toBe('ch');
  });
});

describe('separatorsFor', () => {
  it('returns Swiss apostrophe grouping and dot decimal', () => {
    expect(separatorsFor('ch')).toEqual({ grouping: "'", decimal: '.' });
  });

  it('returns US comma grouping and dot decimal', () => {
    expect(separatorsFor('us')).toEqual({ grouping: ',', decimal: '.' });
  });

  it('returns German dot grouping and comma decimal', () => {
    expect(separatorsFor('de')).toEqual({ grouping: '.', decimal: ',' });
  });
});

describe('formatGroupedNumber', () => {
  it('groups the three styles with two decimal digits', () => {
    expect(formatGroupedNumber(10000.23, 'ch', 2)).toBe("10'000.23");
    expect(formatGroupedNumber(10000.23, 'us', 2)).toBe('10,000.23');
    expect(formatGroupedNumber(23000.33, 'de', 2)).toBe('23.000,33');
  });

  it('groups integers without a decimal part', () => {
    expect(formatGroupedNumber(1500, 'ch', 0)).toBe("1'500");
    expect(formatGroupedNumber(0, 'ch', 0)).toBe('0');
  });

  it('pads and uses the German decimal separator', () => {
    expect(formatGroupedNumber(1.43, 'de', 2)).toBe('1,43');
    expect(formatGroupedNumber(1.5, 'de', 2)).toBe('1,50');
  });

  it('treats non-finite values as zero', () => {
    expect(formatGroupedNumber(Number.NaN, 'ch', 0)).toBe('0');
    expect(formatGroupedNumber(Number.POSITIVE_INFINITY, 'us', 2)).toBe('0.00');
  });

  it('prefixes a minus for negative values', () => {
    expect(formatGroupedNumber(-10000.23, 'ch', 2)).toBe("-10'000.23");
  });

  it('groups millions from the right', () => {
    expect(formatGroupedNumber(1500000, 'ch', 0)).toBe("1'500'000");
    expect(formatGroupedNumber(1500000, 'de', 0)).toBe('1.500.000');
  });
});
