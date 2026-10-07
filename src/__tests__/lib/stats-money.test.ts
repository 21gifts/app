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
  fiatDraftForSats,
  fiatToSats,
  latestRateDayFor,
  parseAmountDraft,
  paySatsFromDraft,
  replySatsFromDraft,
  satsToFiatAmount,
  shownFiatForSats,
  spotRateDay,
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

  it('prefixes CHF and EUR with the code and PHP with the peso sign', () => {
    expect(formatFiatDisplay('1425.00', 'CHF')).toBe("CHF 1'425.00");
    expect(formatFiatDisplay('1.43', 'EUR')).toBe('EUR 1.43');
    expect(formatFiatDisplay('50.00', 'PHP')).toBe('₱50.00');
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
    expect(formatFiatTick(80000, 'PHP')).toBe("₱80'000");
  });
});

const RATE_DAY: FiatRateDay = {
  sats: 100_000_000,
  usd: '100000.00',
  chf: '80000.00',
  eur: '90000.00',
  php: '5600000.00',
};

describe('spotRateDay', () => {
  it('prices 100,000,000 sats at each code the api priced', () => {
    expect(spotRateDay({ USD: '100000', CHF: '80000.5' })).toEqual({
      sats: 100_000_000,
      usd: '100000',
      chf: '80000.5',
      eur: null,
      php: null,
    });
    expect(satsToFiatAmount(1_000, spotRateDay({ CHF: '80000' }), 'CHF')).toBe('0.80');
    expect(satsToFiatAmount(1_000, spotRateDay({ CHF: '80000' }), 'USD')).toBeNull();
  });

  it('returns null when no code has a usable price', () => {
    expect(spotRateDay({})).toBeNull();
    expect(spotRateDay({ USD: '0', EUR: '0.00' })).toBeNull();
  });
});

describe('latestRateDayFor', () => {
  const poisoned = { ...RATE_DAY, sats: 1000, usd: '10.00', chf: null, eur: null, php: null };

  it('skips a newer day that cannot convert the currency', () => {
    expect(latestRateDayFor([RATE_DAY, poisoned], 'PHP')).toEqual(RATE_DAY);
    expect(latestRateDayFor([RATE_DAY, poisoned], 'USD')).toEqual(poisoned);
  });

  it('returns null when no day can convert that currency', () => {
    expect(latestRateDayFor([poisoned], 'PHP')).toBeNull();
    expect(latestRateDayFor([{ ...RATE_DAY, sats: 0, php: '1.00' }], 'PHP')).toBeNull();
    expect(latestRateDayFor([{ ...RATE_DAY, php: '0.00' }], 'PHP')).toBeNull();
    expect(latestRateDayFor([{ ...RATE_DAY, php: 'nope' }], 'PHP')).toBeNull();
    expect(latestRateDayFor([], 'CHF')).toBeNull();
  });
});

describe('shownFiatForSats', () => {
  it('copies the preview amounts for every currency', () => {
    expect(shownFiatForSats(21, RATE_DAY)).toEqual({
      amountUsd: '0.02',
      amountChf: '0.02',
      amountEur: '0.02',
      amountPhp: '1.18',
    });
    expect(shownFiatForSats(21, null)).toEqual({
      amountUsd: null,
      amountChf: null,
      amountEur: null,
      amountPhp: null,
    });
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

  it('returns null when the gift-day fiat total is zero', () => {
    expect(satsToFiatAmount(100_000, { ...RATE_DAY, sats: 1, usd: '0.00' }, 'USD')).toBeNull();
    expect(satsToFiatAmount(21, { ...RATE_DAY, usd: 'nope' }, 'USD')).toBeNull();
  });

  it('returns 0.00 for zero sats', () => {
    expect(satsToFiatAmount(0, RATE_DAY, 'USD')).toBe('0.00');
  });
});

describe('fiatDraftForSats', () => {
  it('keeps two decimals when they round-trip and adds digits when they do not', () => {
    expect(fiatDraftForSats(1000, RATE_DAY, 'USD')).toBe('1.00');
    expect(fiatDraftForSats(21, RATE_DAY, 'USD')).toBe('0.021');
  });

  it('returns null without a usable rate or a finite non-negative amount', () => {
    expect(fiatDraftForSats(21, null, 'USD')).toBeNull();
    expect(fiatDraftForSats(Number.NaN, RATE_DAY, 'USD')).toBeNull();
    expect(fiatDraftForSats(-1, RATE_DAY, 'USD')).toBeNull();
    expect(fiatDraftForSats(21, { ...RATE_DAY, chf: null }, 'CHF')).toBeNull();
    expect(fiatDraftForSats(21, { ...RATE_DAY, sats: 0 }, 'USD')).toBeNull();
    expect(fiatDraftForSats(21, { ...RATE_DAY, usd: '0.00' }, 'USD')).toBeNull();
  });

  it('returns null when no digit count round-trips', () => {
    expect(
      fiatDraftForSats(1, { ...RATE_DAY, sats: 1_000_000_000_000, usd: '1.00' }, 'USD'),
    ).toBeNull();
  });
});

describe('fiatToSats', () => {
  it('inverts a gift-day rate and clamps a positive dust amount to 1', () => {
    expect(fiatToSats(1, RATE_DAY, 'USD')).toBe(1000);
    expect(fiatToSats(0, RATE_DAY, 'USD')).toBe(0);
    expect(fiatToSats(0.0000001, RATE_DAY, 'USD')).toBe(1);
  });

  it('returns null without a usable rate', () => {
    expect(fiatToSats(1, null, 'USD')).toBeNull();
    expect(fiatToSats(1, { ...RATE_DAY, sats: 0 }, 'USD')).toBeNull();
    expect(fiatToSats(1, { ...RATE_DAY, chf: null }, 'CHF')).toBeNull();
    expect(fiatToSats(1, { ...RATE_DAY, usd: '0.00' }, 'USD')).toBeNull();
    expect(fiatToSats(Number.NaN, RATE_DAY, 'USD')).toBeNull();
    expect(fiatToSats(-1, RATE_DAY, 'USD')).toBeNull();
    expect(fiatToSats(1, { ...RATE_DAY, usd: 'nope' }, 'USD')).toBeNull();
    expect(fiatToSats(Number.MAX_VALUE, RATE_DAY, 'USD')).toBeNull();
  });
});

describe('parseAmountDraft', () => {
  it('reads whole sats and a two-decimal fiat draft', () => {
    expect(parseAmountDraft('btc', '', RATE_DAY, 'USD')).toEqual({ kind: 'empty' });
    expect(parseAmountDraft('btc', '21', RATE_DAY, 'USD')).toEqual({ kind: 'sats', sats: 21 });
    expect(parseAmountDraft('btc', '1.5', RATE_DAY, 'USD')).toEqual({ kind: 'invalid' });
    expect(parseAmountDraft('fiat', '1.00', RATE_DAY, 'USD')).toEqual({ kind: 'sats', sats: 1000 });
    expect(parseAmountDraft('fiat', '1,', RATE_DAY, 'USD')).toEqual({ kind: 'sats', sats: 1000 });
    expect(parseAmountDraft('fiat', '1.234', RATE_DAY, 'USD')).toEqual({
      kind: 'sats',
      sats: 1234,
    });
    expect(parseAmountDraft('fiat', '1.123456789', RATE_DAY, 'USD')).toEqual({ kind: 'invalid' });
    expect(parseAmountDraft('fiat', '1.00', null, 'USD')).toEqual({ kind: 'no-rate' });
    expect(parseAmountDraft('fiat', '0', null, 'USD')).toEqual({ kind: 'invalid' });
    expect(parseAmountDraft('fiat', '1.00', { ...RATE_DAY, php: null }, 'PHP')).toEqual({
      kind: 'no-rate',
    });
    expect(parseAmountDraft('btc', '9'.repeat(40), RATE_DAY, 'USD')).toEqual({ kind: 'invalid' });
    expect(parseAmountDraft('fiat', '9'.repeat(400), RATE_DAY, 'USD')).toEqual({ kind: 'invalid' });
    expect(parseAmountDraft('fiat', '90071992547410', RATE_DAY, 'USD')).toEqual({
      kind: 'invalid',
    });
    expect(parseAmountDraft('fiat', '1.00', { ...RATE_DAY, sats: 0 }, 'USD')).toEqual({
      kind: 'invalid',
    });
    expect(parseAmountDraft('fiat', '1.00', { ...RATE_DAY, php: '0.00' }, 'PHP')).toEqual({
      kind: 'no-rate',
    });
    expect(parseAmountDraft('fiat', '1.00', { ...RATE_DAY, php: 'nope' }, 'PHP')).toEqual({
      kind: 'no-rate',
    });
  });
});

describe('replySatsFromDraft and paySatsFromDraft', () => {
  it('keeps an empty reply empty and bills 0 as 1', () => {
    expect(replySatsFromDraft('', 'btc', RATE_DAY, 'USD')).toBe('empty');
    expect(replySatsFromDraft('0', 'btc', RATE_DAY, 'USD')).toBe(1);
    expect(replySatsFromDraft('nope', 'fiat', RATE_DAY, 'USD')).toBe('invalid');
    expect(replySatsFromDraft('1.00', 'fiat', null, 'USD')).toBe('invalid');
  });

  it('treats a blank pay field as 21 sats', () => {
    expect(paySatsFromDraft('  ', 'fiat', RATE_DAY, 'USD')).toBe(21);
    expect(paySatsFromDraft('0', 'btc', RATE_DAY, 'USD')).toBe('invalid');
    expect(paySatsFromDraft('1.00', 'fiat', RATE_DAY, 'USD')).toBe(1000);
    expect(paySatsFromDraft('1.00', 'fiat', null, 'USD')).toBe('invalid');
  });
});
