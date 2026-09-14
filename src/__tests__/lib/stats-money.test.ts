// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  defaultFiatForLocale,
  parseFiatCode,
  formatBitcoin,
  formatFiatDisplay,
  formatFiatTick,
  formatUsdDisplay,
  formatUsdTick,
  latestRateDay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';

describe('defaultFiatForLocale', () => {
  it('maps each UI locale to a stats fiat', () => {
    expect(defaultFiatForLocale('de')).toBe('CHF');
    expect(defaultFiatForLocale('fil')).toBe('PHP');
    expect(defaultFiatForLocale('es')).toBe('EUR');
    expect(defaultFiatForLocale('en')).toBe('USD');
  });
});

describe('parseFiatCode', () => {
  it('returns a supported code and otherwise the fallback', () => {
    expect(parseFiatCode('CHF', 'USD')).toBe('CHF');
    expect(parseFiatCode('EUR', 'USD')).toBe('EUR');
    expect(parseFiatCode('xx', 'USD')).toBe('USD');
    expect(parseFiatCode(undefined, 'CHF')).toBe('CHF');
  });
});

describe('formatUsdDisplay', () => {
  it('formats a two-decimal API string with Swiss grouping by default', () => {
    expect(formatUsdDisplay('1425.00')).toBe("$1'425.00");
  });

  it('keeps cents', () => {
    expect(formatUsdDisplay('1.50')).toBe('$1.50');
  });
});

describe('formatFiatDisplay', () => {
  it('formats USD with a dollar symbol', () => {
    expect(formatFiatDisplay('1425.00', 'USD')).toBe("$1'425.00");
  });

  it('prefixes CHF EUR and PHP with the currency code', () => {
    expect(formatFiatDisplay('1425.00', 'CHF')).toBe("CHF 1'425.00");
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

  it('groups with Swiss apostrophes by default', () => {
    expect(formatBitcoin(1500)).toBe("₿1'500");
  });

  it('groups with US commas', () => {
    expect(formatBitcoin(1500, 'us')).toBe('₿1,500');
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
});

describe('formatFiatTick', () => {
  it('keeps USD ticks identical to formatUsdTick', () => {
    expect(formatFiatTick(0, 'USD')).toBe('$0');
    expect(formatFiatTick(1.43, 'USD')).toBe('$1.43');
    expect(formatFiatTick(1425, 'USD')).toBe("$1'425");
  });

  it('prefixes other codes and trims small fractions', () => {
    expect(formatFiatTick(0, 'CHF')).toBe('CHF 0');
    expect(formatFiatTick(1.43, 'CHF')).toBe('CHF 1.43');
    expect(formatFiatTick(1425, 'CHF')).toBe("CHF 1'425");
    expect(formatFiatTick(1.43, 'EUR')).toBe('EUR 1.43');
    expect(formatFiatTick(80000, 'PHP')).toBe("PHP 80'000");
  });
});

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

describe('latestRateDay', () => {
  it('returns the last day with gifts', () => {
    expect(latestRateDay([{ ...RATE_DAY, sats: 0 }, RATE_DAY])).toEqual(RATE_DAY);
  });

  it('returns null when every day is empty', () => {
    expect(latestRateDay([{ ...RATE_DAY, sats: 0 }])).toBeNull();
    expect(latestRateDay([])).toBeNull();
  });
});

describe('satsToFiatAmount', () => {
  it('scales 21 sats off a 1 BTC day', () => {
    expect(satsToFiatAmount(21, RATE_DAY, 'USD')).toBe('0.02');
    expect(satsToFiatAmount(21, RATE_DAY, 'CHF')).toBe('0.02');
    expect(satsToFiatAmount(21, RATE_DAY, 'EUR')).toBe('0.02');
    expect(satsToFiatAmount(21, RATE_DAY, 'PHP')).toBe('1.18');
  });

  it('returns null without a rate day or when that fiat is missing', () => {
    expect(satsToFiatAmount(21, null, 'CHF')).toBeNull();
    expect(satsToFiatAmount(21, { ...RATE_DAY, chf: null }, 'CHF')).toBeNull();
    expect(satsToFiatAmount(-1, RATE_DAY, 'USD')).toBeNull();
  });

  it('returns 0.00 for zero sats', () => {
    expect(satsToFiatAmount(0, RATE_DAY, 'USD')).toBe('0.00');
  });
});
