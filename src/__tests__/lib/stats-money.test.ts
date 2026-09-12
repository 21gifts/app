// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  defaultFiatForLocale,
  formatBitcoin,
  formatFiatDisplay,
  formatFiatTick,
  formatUsdDisplay,
  formatUsdTick,
} from '@/lib/stats-money';

describe('defaultFiatForLocale', () => {
  it('maps each UI locale to a stats fiat', () => {
    expect(defaultFiatForLocale('de')).toBe('CHF');
    expect(defaultFiatForLocale('fil')).toBe('PHP');
    expect(defaultFiatForLocale('es')).toBe('EUR');
    expect(defaultFiatForLocale('en')).toBe('USD');
  });
});

describe('formatUsdDisplay', () => {
  it('formats a two-decimal API string as en-US currency', () => {
    expect(formatUsdDisplay('1425.00')).toBe('$1,425.00');
  });

  it('keeps cents', () => {
    expect(formatUsdDisplay('1.50')).toBe('$1.50');
  });
});

describe('formatFiatDisplay', () => {
  it('formats USD with a dollar symbol', () => {
    expect(formatFiatDisplay('1425.00', 'USD')).toBe('$1,425.00');
  });

  it('prefixes CHF EUR and PHP with the currency code', () => {
    expect(formatFiatDisplay('1425.00', 'CHF')).toBe('CHF 1,425.00');
    expect(formatFiatDisplay('1.43', 'EUR')).toBe('EUR 1.43');
    expect(formatFiatDisplay('50.00', 'PHP')).toBe('PHP 50.00');
  });

  it('renders null as an em dash', () => {
    expect(formatFiatDisplay(null, 'CHF')).toBe('—');
    expect(formatFiatDisplay(null, 'USD')).toBe('—');
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

describe('formatFiatTick', () => {
  it('keeps USD ticks identical to formatUsdTick', () => {
    expect(formatFiatTick(0, 'USD')).toBe('$0');
    expect(formatFiatTick(1.43, 'USD')).toBe('$1.43');
    expect(formatFiatTick(1425, 'USD')).toBe('$1,425');
  });

  it('prefixes other codes and trims small fractions', () => {
    expect(formatFiatTick(0, 'CHF')).toBe('CHF 0');
    expect(formatFiatTick(1.43, 'CHF')).toBe('CHF 1.43');
    expect(formatFiatTick(1425, 'CHF')).toBe('CHF 1,425');
    expect(formatFiatTick(1.43, 'EUR')).toBe('EUR 1.43');
    expect(formatFiatTick(80000, 'PHP')).toBe('PHP 80,000');
  });
});
