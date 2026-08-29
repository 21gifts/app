import { describe, expect, it } from 'vitest';
import type { GiftStats } from '@/lib/api-types';
import { accountTotals, recipientHandleFromAddress } from '@/lib/account-totals';

const STATS: GiftStats = {
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-07-01T00:00:00.000Z',
  spendOverTime: [],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' },
    { recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' },
  ],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

describe('recipientHandleFromAddress', () => {
  it('returns the local-part before the first @', () => {
    expect(recipientHandleFromAddress('alice@walletofsatoshi.com')).toBe('alice');
  });

  it('returns the whole string when there is no @ after the first character', () => {
    expect(recipientHandleFromAddress('alice')).toBe('alice');
    expect(recipientHandleFromAddress('@alice')).toBe('@alice');
  });

  it('keeps an empty string empty', () => {
    expect(recipientHandleFromAddress('')).toBe('');
  });
});

describe('accountTotals', () => {
  it('maps a matching byRecipient row case-insensitively and keeps donated at 0', () => {
    expect(accountTotals(STATS, 'Alice@walletofsatoshi.com')).toEqual({
      donatedSats: 0,
      receivedSats: 1000,
    });
  });

  it('trims surrounding whitespace before matching the recipient handle', () => {
    expect(accountTotals(STATS, ' Alice@walletofsatoshi.com ')).toEqual({
      donatedSats: 0,
      receivedSats: 1000,
    });
  });

  it('returns zeros when the address is null or blank', () => {
    expect(accountTotals(STATS, null)).toEqual({ donatedSats: 0, receivedSats: 0 });
    expect(accountTotals(STATS, '   ')).toEqual({ donatedSats: 0, receivedSats: 0 });
  });

  it('returns zeros when no recipient row matches', () => {
    expect(accountTotals(STATS, 'carol@walletofsatoshi.com')).toEqual({
      donatedSats: 0,
      receivedSats: 0,
    });
  });

  it('always reports donatedSats as 0', () => {
    expect(accountTotals(STATS, 'bob@walletofsatoshi.com').donatedSats).toBe(0);
  });
});
