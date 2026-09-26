import { describe, expect, it } from 'vitest';
import { creditSmallestUnits, parseCreditTermDays, splitCreditPlan } from '@/lib/credit-plan';

describe('credit plan', () => {
  it('uses the preset day counts and rejects a bad custom term', () => {
    expect(parseCreditTermDays(30, '')).toBe(30);
    expect(parseCreditTermDays(365, '9')).toBe(365);
    expect(parseCreditTermDays(730, '')).toBe(730);
    expect(parseCreditTermDays('custom', '45')).toBe(45);
    expect(parseCreditTermDays('custom', '0')).toBeNull();
    expect(parseCreditTermDays('custom', '3651')).toBeNull();
    expect(parseCreditTermDays('custom', '1.5')).toBeNull();
  });

  it('splits an even fiat amount, an uneven fiat amount, and sats', () => {
    expect(creditSmallestUnits('30.00', false)).toBe(3000n);
    expect(creditSmallestUnits('1000', false)).toBe(100000n);
    expect(creditSmallestUnits('21000', true)).toBe(21000n);
    expect(creditSmallestUnits('1.2.3', false)).toBeNull();
    expect(splitCreditPlan(3000n, 30)).toEqual({
      perDay: 100n,
      last: 100n,
      days: 30,
      remainder: 0n,
    });
    expect(splitCreditPlan(100000n, 30)).toEqual({
      perDay: 3333n,
      last: 3343n,
      days: 30,
      remainder: 10n,
    });
    expect(splitCreditPlan(21000n, 30)).toEqual({
      perDay: 700n,
      last: 700n,
      days: 30,
      remainder: 0n,
    });
    expect(splitCreditPlan(10n, 30)).toEqual({
      perDay: 0n,
      last: 10n,
      days: 30,
      remainder: 10n,
    });
    expect(splitCreditPlan(10n, 0)).toBeNull();
  });
});
