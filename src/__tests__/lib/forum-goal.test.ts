import { describe, expect, it } from 'vitest';
import {
  formatDefinedGoalAmount,
  forumAskFunded,
  forumAskPercent,
  forumFiatGoalPercent,
  forumGoalPercent,
  parseForumAskAmount,
  parseForumAskAmountInUnit,
} from '@/lib/forum-goal';

describe('forumGoalPercent', () => {
  it('returns 110 for 23100/21000', () => {
    expect(forumGoalPercent(23100, 21000)).toBe(110);
  });

  it('returns 0 for 0/21000', () => {
    expect(forumGoalPercent(0, 21000)).toBe(0);
  });

  it('returns 100 for 21000/21000', () => {
    expect(forumGoalPercent(21000, 21000)).toBe(100);
  });

  it('returns 50 for 10500/21000', () => {
    expect(forumGoalPercent(10500, 21000)).toBe(50);
  });

  it('floors 21001/21000 to 100', () => {
    expect(forumGoalPercent(21001, 21000)).toBe(100);
  });

  it('returns 0 when goalSats is 0 or negative', () => {
    expect(forumGoalPercent(21000, 0)).toBe(0);
    expect(forumGoalPercent(21000, -21000)).toBe(0);
  });

  it('is uncapped at 250 for 52500/21000', () => {
    expect(forumGoalPercent(52500, 21000)).toBe(250);
  });
});

describe('parseForumAskAmount', () => {
  it('parses 21000', () => {
    expect(parseForumAskAmount('21000')).toBe(21000);
  });

  it('returns null for empty, non-digits, 0, and over the max', () => {
    expect(parseForumAskAmount('')).toBeNull();
    expect(parseForumAskAmount('abc')).toBeNull();
    expect(parseForumAskAmount('0')).toBeNull();
    expect(parseForumAskAmount('10000001')).toBeNull();
  });
});

const DAY = { sats: 100_000_000, usd: '100000.00', chf: null, eur: null, php: null };

describe('parseForumAskAmountInUnit', () => {
  it('keeps a bitcoin draft and converts fiat inside the ask range', () => {
    expect(parseForumAskAmountInUnit('21000', 'btc', DAY, 'USD')).toBe(21000);
    expect(parseForumAskAmountInUnit('1.00', 'fiat', DAY, 'USD')).toBe(1000);
    expect(parseForumAskAmountInUnit('1.00', 'fiat', null, 'USD')).toBeNull();
    expect(parseForumAskAmountInUnit('0', 'fiat', DAY, 'USD')).toBeNull();
  });
});

describe('forumFiatGoalPercent', () => {
  it('returns 2 for 5.06 of 200', () => {
    expect(forumFiatGoalPercent('5.06', '200')).toBe(2);
  });

  it('returns 110 for 11.00 of 10.00', () => {
    expect(forumFiatGoalPercent('11.00', '10.00')).toBe(110);
  });

  it('returns 0 when collected is null, missing, or not two decimals', () => {
    expect(forumFiatGoalPercent(null, '10.00')).toBe(0);
    expect(forumFiatGoalPercent(undefined, '10.00')).toBe(0);
    expect(forumFiatGoalPercent('5.0', '10.00')).toBe(0);
  });

  it('returns 0 when the goal is unusable or scales to zero', () => {
    expect(forumFiatGoalPercent('5.00', 'nope')).toBe(0);
    expect(forumFiatGoalPercent('5.00', '0')).toBe(0);
    expect(forumFiatGoalPercent('5.00', '0.00')).toBe(0);
  });

  it('is uncapped at 250 for 25.00 of 10.00', () => {
    expect(forumFiatGoalPercent('25.00', '10.00')).toBe(250);
  });

  it('returns 50 for 100.00 of 200', () => {
    expect(forumFiatGoalPercent('100.00', '200')).toBe(50);
  });

  it('returns 49 for 5.06 of 10.125', () => {
    expect(forumFiatGoalPercent('5.06', '10.125')).toBe(49);
  });

  it('returns 125 for 250.00 of 200', () => {
    expect(forumFiatGoalPercent('250.00', '200')).toBe(125);
  });

  it('caps a quotient above MAX_SAFE_INTEGER', () => {
    expect(forumFiatGoalPercent('99999999.99', '0.00000001')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('formatDefinedGoalAmount', () => {
  it('returns an empty string for unusable input', () => {
    expect(formatDefinedGoalAmount('', 'PHP', 'ch')).toBe('');
    expect(formatDefinedGoalAmount('   ', 'PHP', 'ch')).toBe('');
    expect(formatDefinedGoalAmount('abc', 'PHP', 'ch')).toBe('');
    expect(formatDefinedGoalAmount('10.1,2', 'PHP', 'ch')).toBe('');
  });

  it('pads at most two fraction digits and keeps more than two', () => {
    expect(formatDefinedGoalAmount('200', 'PHP', 'ch')).toBe('₱200.00');
    expect(formatDefinedGoalAmount('10.1', 'PHP', 'ch')).toBe('₱10.10');
    expect(formatDefinedGoalAmount('10.125', 'PHP', 'ch')).toBe('₱10.125');
    expect(formatDefinedGoalAmount('10.1200', 'PHP', 'ch')).toBe('₱10.1200');
  });

  it('treats a single comma as the decimal mark, including a hanging separator', () => {
    expect(formatDefinedGoalAmount('10,125', 'PHP', 'ch')).toBe('₱10.125');
    expect(formatDefinedGoalAmount('10,', 'PHP', 'ch')).toBe('₱10.00');
    expect(formatDefinedGoalAmount('10.', 'PHP', 'ch')).toBe('₱10.00');
  });

  it('groups with the visitor style and prefixes USD with $', () => {
    expect(formatDefinedGoalAmount('1200', 'PHP', 'ch')).toBe("₱1'200.00");
    expect(formatDefinedGoalAmount('1200', 'USD', 'us')).toBe('$1,200.00');
    expect(formatDefinedGoalAmount('1200', 'EUR', 'de')).toBe('EUR 1.200,00');
  });
});

describe('forumAskFunded', () => {
  it('funds a PHP ask of 5000 once amountPhp reaches it, even short of goalSats', () => {
    const note = {
      sats: 96_940,
      goalSats: 97_013,
      goalCurrency: 'PHP' as const,
      goalAmount: '5000',
      amountPhp: '5000.85',
    };
    expect(forumAskFunded(note)).toBe(true);
    expect(forumAskPercent(note)).toBe(100);
  });

  it('does not fund a fiat ask that reached its sats but not its fiat amount', () => {
    const note = {
      sats: 21_000,
      goalSats: 21_000,
      goalCurrency: 'USD' as const,
      goalAmount: '20',
      amountUsd: '10.00',
    };
    expect(forumAskFunded(note)).toBe(false);
    expect(forumAskPercent(note)).toBe(50);
  });

  it('keeps the sats rule for a BTC ask and a legacy row', () => {
    expect(
      forumAskFunded({ sats: 21_000, goalSats: 21_000, goalCurrency: 'BTC', goalAmount: '21000' }),
    ).toBe(true);
    expect(forumAskFunded({ sats: 20_999, goalSats: 21_000, goalCurrency: 'BTC' })).toBe(false);
    expect(forumAskFunded({ sats: 21_000, goalSats: 21_000 })).toBe(true);
    expect(forumAskFunded({ sats: 20_999, goalSats: 21_000 })).toBe(false);
  });

  it('does not fund a fiat ask with a missing snapshot, a bad snapshot, or a zero goal', () => {
    expect(
      forumAskFunded({
        sats: 21_000,
        goalSats: 21_000,
        goalCurrency: 'CHF',
        goalAmount: '20',
        amountChf: null,
      }),
    ).toBe(false);
    expect(
      forumAskFunded({
        sats: 21_000,
        goalSats: 21_000,
        goalCurrency: 'EUR',
        goalAmount: '20',
      }),
    ).toBe(false);
    expect(
      forumAskFunded({
        sats: 21_000,
        goalSats: 21_000,
        goalCurrency: 'USD',
        goalAmount: '20',
        amountUsd: '10',
      }),
    ).toBe(false);
    expect(
      forumAskFunded({
        sats: 21_000,
        goalSats: 21_000,
        goalCurrency: 'PHP',
        goalAmount: '0',
        amountPhp: '0.00',
      }),
    ).toBe(false);
  });

  it('falls back to the sats when the fiat amount is unusable', () => {
    expect(
      forumAskFunded({
        sats: 10,
        goalSats: 10,
        goalCurrency: 'USD',
        goalAmount: 'nope',
        amountUsd: '0.00',
      }),
    ).toBe(true);
    expect(
      forumAskFunded({ sats: 5, goalSats: 10, goalCurrency: 'USD', goalAmount: 'nope' }),
    ).toBe(false);
  });
});

describe('forumAskPercent', () => {
  it('uses the sats for a bitcoin or legacy ask', () => {
    expect(forumAskPercent({ sats: 10_500, goalSats: 21_000 })).toBe(50);
    expect(forumAskPercent({ sats: 21_000, goalSats: 21_000, goalCurrency: 'BTC' })).toBe(100);
  });

  it('uses the payment snapshot in the definition code for a fiat ask', () => {
    for (const [code, field] of [
      ['USD', 'amountUsd'],
      ['CHF', 'amountChf'],
      ['EUR', 'amountEur'],
      ['PHP', 'amountPhp'],
    ] as const) {
      expect(
        forumAskPercent({
          sats: 1,
          goalSats: 1,
          goalCurrency: code,
          goalAmount: '20',
          [field]: '10.00',
          amountUsd: code === 'USD' ? '10.00' : '20.00',
        }),
      ).toBe(50);
    }
    expect(forumAskPercent({ sats: 999, goalSats: 1, goalCurrency: 'USD', goalAmount: '20' })).toBe(
      0,
    );
  });

  it('falls back to the sats when the defined amount is unusable', () => {
    expect(
      forumAskPercent({ sats: 5, goalSats: 10, goalCurrency: 'USD', goalAmount: 'nope' }),
    ).toBe(50);
    expect(forumAskPercent({ sats: 5, goalSats: 10, goalCurrency: 'USD' })).toBe(50);
  });
});
