import { describe, expect, it } from 'vitest';
import type { MyLoan, RepaymentLedger } from '@/lib/api';
import { dueShares, fittingPrefix, summarizeLoans } from '@/lib/loan-repay';

function loan(overrides: Partial<MyLoan> = {}): MyLoan {
  return {
    messageId: 'm1',
    text: 'Train ticket',
    createdAt: '2026-10-01T12:00:00.000Z',
    goalSats: 1_000,
    sats: 700,
    goalCurrency: 'BTC',
    goalAmount: '1000',
    goalAmountUsd: null,
    goalAmountChf: null,
    goalAmountEur: null,
    goalAmountPhp: null,
    amountUsd: null,
    amountChf: null,
    amountEur: null,
    amountPhp: null,
    termDays: 30,
    fundedAt: '2026-10-02T12:00:00.000Z',
    daysDue: 2,
    daysPaid: 1,
    repaidSats: 100,
    totalSats: 1_000,
    due: {
      payableSats: 300,
      payablePeople: 1,
      waitingSats: 20,
      waitingPeople: 1,
      behindDays: 2,
      payableAmount: null,
      waitingAmount: null,
      lastPayment: true,
    },
    next: { dueOn: '2026-10-12', sats: 100, amount: null },
    ...overrides,
  };
}

function ledger(overrides: Partial<RepaymentLedger> = {}): RepaymentLedger {
  return {
    currency: 'BTC',
    fundedAt: '2026-10-02T12:00:00.000Z',
    termDays: 30,
    daysDue: 2,
    daysPaid: 1,
    unassignedSats: 0,
    givers: [
      {
        accountId: 'acc_1',
        name: 'Bruno',
        username: 'bruno',
        givenSats: 500,
        givenAmount: null,
        canReceive: false,
      },
    ],
    repayments: [
      {
        dayIndex: 2,
        dueOn: '2026-10-12',
        accountId: 'acc_1',
        name: 'Bruno',
        username: 'bruno',
        amount: null,
        sats: 100,
        dueSats: null,
        status: 'due',
        via: 'lightning',
      },
    ],
    next: null,
    ...overrides,
  };
}

describe('summarizeLoans', () => {
  it('combines totals, caps progress, and groups the earliest next day', () => {
    const summary = summarizeLoans({
      sundayRest: false,
      loans: [
        loan(),
        loan({
          messageId: 'm2',
          goalSats: 500,
          sats: 900,
          fundedAt: null,
          due: {
            payableSats: 0,
            payablePeople: 0,
            waitingSats: 30,
            waitingPeople: 2,
            behindDays: 1,
            payableAmount: null,
            waitingAmount: null,
            lastPayment: true,
          },
          next: { dueOn: '2026-10-11', sats: 40, amount: null },
        }),
        loan({
          messageId: 'm3',
          next: { dueOn: '2026-10-11', sats: 60, amount: null },
        }),
        loan({ messageId: 'm4', next: { dueOn: '2026-10-10', sats: null, amount: '2.00' } }),
        loan({ messageId: 'm5', next: null }),
      ],
    });
    expect(summary).toEqual({
      count: 5,
      fundedCount: 4,
      goalSats: 4_500,
      sats: 3_300,
      sundayRest: false,
      payableSats: 1_200,
      waitingSats: 110,
      waitingPeople: 6,
      behindDays: 2,
      payableLoans: 4,
      lastPayment: true,
      next: { dueOn: '2026-10-11', sats: 100 },
      tone: 'danger',
      payable: true,
    });
  });

  it('uses success only for a funded, clear, non-Sunday body', () => {
    const clear = loan({
      due: {
        payableSats: 0,
        payablePeople: 0,
        waitingSats: 0,
        waitingPeople: 0,
        behindDays: 0,
        payableAmount: null,
        waitingAmount: null,
        lastPayment: false,
      },
      next: null,
    });
    expect(summarizeLoans({ sundayRest: false, loans: [clear] }).tone).toBe('success');
    expect(summarizeLoans({ sundayRest: true, loans: [clear] })).toMatchObject({
      tone: 'neutral',
      payable: false,
      next: null,
    });
    expect(
      summarizeLoans({ sundayRest: false, loans: [loan({ ...clear, fundedAt: null })] }).tone,
    ).toBe('neutral');
    expect(summarizeLoans({ sundayRest: false, loans: [] })).toMatchObject({
      tone: 'neutral',
      fundedCount: 0,
      behindDays: 0,
    });
  });

  it('keeps an earlier next day when a later valid day follows it', () => {
    expect(
      summarizeLoans({
        sundayRest: false,
        loans: [
          loan({ next: { dueOn: '2026-10-11', sats: 40, amount: null } }),
          loan({ next: { dueOn: '2026-10-12', sats: 60, amount: null } }),
        ],
      }).next,
    ).toEqual({ dueOn: '2026-10-11', sats: 40 });
  });
});

describe('dueShares', () => {
  it('orders due rows by day, loan, and row while mapping availability and fallback sats', () => {
    const first = ledger({
      repayments: [
        {
          ...ledger().repayments[0]!,
          dayIndex: 2,
          sats: null,
          dueSats: 90,
          amount: '1.00',
        },
        {
          ...ledger().repayments[0]!,
          dayIndex: 1,
          accountId: 'not-listed',
          name: 'Ada',
          sats: null,
          dueSats: null,
        },
        { ...ledger().repayments[0]!, dayIndex: 0, status: 'paid' },
      ],
    });
    const second = ledger({
      repayments: [
        { ...ledger().repayments[0]!, dayIndex: 1, name: 'Cara' },
        { ...ledger().repayments[0]!, dayIndex: 1, name: 'Diego' },
      ],
    });
    expect(
      dueShares(
        [loan(), loan({ messageId: 'm2' }), loan({ messageId: 'm3' })],
        [first, second, null],
      ),
    ).toEqual([
      expect.objectContaining({
        messageId: 'm1',
        loanIndex: 0,
        dayIndex: 1,
        name: 'Ada',
        sats: null,
        canReceive: true,
      }),
      expect.objectContaining({
        messageId: 'm2',
        loanIndex: 1,
        dayIndex: 1,
        name: 'Cara',
        sats: 100,
        canReceive: false,
      }),
      expect.objectContaining({
        messageId: 'm2',
        loanIndex: 1,
        dayIndex: 1,
        name: 'Diego',
        sats: 100,
        canReceive: false,
      }),
      expect.objectContaining({
        messageId: 'm1',
        loanIndex: 0,
        dayIndex: 2,
        name: 'Bruno',
        sats: 90,
        amount: '1.00',
        canReceive: false,
      }),
    ]);
  });

  it('treats a missing matching ledger as empty', () => {
    expect(dueShares([loan()], [])).toEqual([]);
  });
});

describe('fittingPrefix', () => {
  it('stops before the first over-budget or unknown item without skipping', () => {
    expect(fittingPrefix([2, 3, 1], (value) => value, 4)).toEqual([2]);
    expect(fittingPrefix([1, 2, 3], (value) => (value === 2 ? null : value), 10)).toEqual([1]);
    expect(fittingPrefix([0, 1], (value) => value, 1)).toEqual([0, 1]);
  });
});
