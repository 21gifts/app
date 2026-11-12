import { describe, expect, it } from 'vitest';
import {
  ledgerClosedPartial,
  ledgerClosedPartialFiat,
  loanClosedPartial,
} from '../../../e2e/loan-fixtures';
import type { MyLoan, RepaymentLedger } from '@/lib/api';
import {
  centsString,
  checkLoanAmount,
  definedFiatAmounts,
  definedDueLabel,
  definedFiatSum,
  dueShares,
  fittingPrefix,
  isCollecting,
  loanMaxInput,
  loanMaxUnits,
  parseLoanAmount,
  remainingRepaymentSats,
  summarizeLoans,
  validatedRepaymentPayment,
} from '@/lib/loan-repay';

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
    closedAt: null,
    maxSats: 900,
    maxAmount: null,
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
    closedAt: null,
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
        paidSats: 0,
        paidAmount: null,
        dueSats: null,
        status: 'due',
        via: 'lightning',
      },
    ],
    next: null,
    ...overrides,
  };
}

describe('free loan amount helpers', () => {
  it('parses BTC as positive whole sats without floats', () => {
    expect(parseLoanAmount(' 0010 ', 'BTC')).toEqual({ units: 10n, text: '0010' });
    for (const value of ['', '0', '-1', '1.0', '1,0', '+1', '1e3', '1 000']) {
      expect(parseLoanAmount(value, 'BTC')).toBeNull();
    }
  });

  it('parses fiat comma or dot amounts as cents and keeps the typed separator', () => {
    expect(parseLoanAmount('12.34', 'CHF')).toEqual({ units: 1_234n, text: '12.34' });
    expect(parseLoanAmount(' 12,3 ', 'EUR')).toEqual({ units: 1_230n, text: '12,3' });
    expect(parseLoanAmount('12', 'USD')).toEqual({ units: 1_200n, text: '12' });
    expect(parseLoanAmount('999999999999999999999.99', 'PHP')?.units).toBe(
      99_999_999_999_999_999_999_999n,
    );
    for (const value of ['', '0', '0.00', '-1', '.5', '1.', '1.234', '1,2.3', 'NaN']) {
      expect(parseLoanAmount(value, 'USD')).toBeNull();
    }
  });

  it('reads BTC and fiat maxima in integer units and preserves Max input text', () => {
    const btc = loan({ maxSats: 1_234, maxAmount: null });
    const fiat = loan({ goalCurrency: 'CHF', maxSats: 8_000, maxAmount: '12.30' });
    expect(loanMaxUnits(btc)).toBe(1_234n);
    expect(loanMaxInput(btc)).toBe('1234');
    expect(loanMaxUnits(fiat)).toBe(1_230n);
    expect(loanMaxInput(fiat)).toBe('12.30');
    expect(loanMaxUnits({ ...fiat, maxSats: null })).toBeNull();
    expect(loanMaxInput({ ...fiat, maxSats: null })).toBeNull();
    const fiatWithoutRate = { ...fiat };
    delete fiatWithoutRate.maxSats;
    expect(loanMaxUnits(fiatWithoutRate)).toBeNull();
    expect(loanMaxInput(fiatWithoutRate)).toBeNull();
    expect(loanMaxUnits({ ...fiat, maxAmount: 'bad' })).toBeNull();
    expect(loanMaxInput({ ...fiat, maxAmount: null })).toBeNull();
    expect(loanMaxUnits({ ...btc, maxSats: null })).toBeNull();
    const legacyBtc = { ...btc };
    const legacyFiat = { ...fiat };
    delete legacyBtc.maxSats;
    delete legacyBtc.maxAmount;
    delete legacyFiat.maxAmount;
    expect(loanMaxUnits(legacyBtc)).toBeNull();
    expect(loanMaxInput(legacyBtc)).toBeNull();
    expect(loanMaxUnits(legacyFiat)).toBeNull();
    expect(loanMaxInput(legacyFiat)).toBeNull();
  });

  it('validates empty, malformed, unavailable, above-max, and accepted inputs', () => {
    const btc = loan({ maxSats: 500 });
    expect(checkLoanAmount('', btc)).toEqual({ ok: false, reason: 'empty', max: '500' });
    expect(checkLoanAmount('1.5', btc)).toEqual({ ok: false, reason: 'invalid', max: '500' });
    expect(checkLoanAmount('501', btc)).toEqual({ ok: false, reason: 'above_max', max: '500' });
    expect(checkLoanAmount(' 500 ', btc)).toEqual({ ok: true, text: '500' });
    const fiat = loan({ goalCurrency: 'USD', maxSats: 8_000, maxAmount: '10.50' });
    expect(checkLoanAmount('10,51', fiat)).toEqual({
      ok: false,
      reason: 'above_max',
      max: '10.50',
    });
    expect(checkLoanAmount('10,5', fiat)).toEqual({ ok: true, text: '10,5' });
    expect(checkLoanAmount('1.00', { ...fiat, maxAmount: null })).toEqual({
      ok: false,
      reason: 'no_max',
      max: null,
    });
  });

  it('collects only before funding and before an explicit close', () => {
    expect(isCollecting(loan({ fundedAt: null, closedAt: null }))).toBe(true);
    const withoutClosedAt = loan({ fundedAt: null });
    delete withoutClosedAt.closedAt;
    expect(isCollecting(withoutClosedAt)).toBe(true);
    expect(isCollecting(loan({ fundedAt: 'funded', closedAt: null }))).toBe(false);
    expect(isCollecting(loan({ fundedAt: null, closedAt: 'closed' }))).toBe(false);
  });
});

describe('summarizeLoans', () => {
  it('combines totals, caps progress, and groups the earliest next day', () => {
    const summary = summarizeLoans(
      {
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
      },
      'ch',
    );
    expect(summary).toEqual({
      count: 5,
      fundedCount: 4,
      sundayRest: false,
      payableSats: 1_200,
      waitingSats: 110,
      waitingPeople: 6,
      behindDays: 2,
      payableLoans: 4,
      lastPayment: true,
      next: { dueOn: '2026-10-11', sats: 100, amount: null },
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
    expect(summarizeLoans({ sundayRest: false, loans: [clear] }, 'ch').tone).toBe('success');
    expect(summarizeLoans({ sundayRest: true, loans: [clear] }, 'ch')).toMatchObject({
      tone: 'neutral',
      payable: false,
      next: null,
    });
    expect(
      summarizeLoans({ sundayRest: false, loans: [loan({ ...clear, fundedAt: null })] }, 'ch').tone,
    ).toBe('neutral');
    expect(summarizeLoans({ sundayRest: false, loans: [] }, 'ch')).toMatchObject({
      tone: 'neutral',
      fundedCount: 0,
      behindDays: 0,
    });
  });

  it('keeps an earlier next day when a later valid day follows it', () => {
    expect(
      summarizeLoans(
        {
          sundayRest: false,
          loans: [
            loan({ next: { dueOn: '2026-10-11', sats: 40, amount: null } }),
            loan({ next: { dueOn: '2026-10-12', sats: 60, amount: null } }),
          ],
        },
        'ch',
      ).next,
    ).toEqual({ dueOn: '2026-10-11', sats: 40, amount: null });
  });

  it('sums the stored next amounts of one fiat currency on the same day', () => {
    const php = (amount: string | null, sats: number, dueOn = '2026-10-11'): MyLoan =>
      loan({
        goalCurrency: 'PHP',
        next: { dueOn, sats, amount },
      });
    expect(
      summarizeLoans({ sundayRest: false, loans: [php('199.99', 40), php('200.48', 60)] }, 'ch')
        .next,
    ).toEqual({ dueOn: '2026-10-11', sats: 100, amount: '₱400.47' });
  });

  it('uses only loans with sats for the same-day next amount', () => {
    const dueOn = '2026-10-11';
    expect(
      summarizeLoans(
        {
          sundayRest: false,
          loans: [
            loan({ goalCurrency: 'PHP', next: { dueOn, sats: 40, amount: '2.00' } }),
            loan({
              messageId: 'm2',
              goalCurrency: 'PHP',
              next: { dueOn, sats: null, amount: '3.00' },
            }),
          ],
        },
        'ch',
      ).next,
    ).toEqual({ dueOn, sats: 40, amount: '₱2.00' });
  });

  it('sums mixed same-day currencies in first-seen order and leaves undefined parts null', () => {
    const dueOn = '2026-10-11';
    const mixed = summarizeLoans(
      {
        sundayRest: false,
        loans: [
          loan({ goalCurrency: 'PHP', next: { dueOn, sats: 40, amount: '2.00' } }),
          loan({ goalCurrency: 'USD', next: { dueOn, sats: 60, amount: '3.00' } }),
          loan({ goalCurrency: 'PHP', next: { dueOn, sats: 20, amount: '1.00' } }),
        ],
      },
      'ch',
    );
    expect(mixed.next).toEqual({ dueOn, sats: 120, amount: '₱3.00 + $3.00' });
    const missing = summarizeLoans(
      {
        sundayRest: false,
        loans: [
          loan({ goalCurrency: 'PHP', next: { dueOn, sats: 40, amount: '2.00' } }),
          loan({ goalCurrency: 'PHP', next: { dueOn, sats: 60, amount: null } }),
        ],
      },
      'ch',
    );
    expect(missing.next).toEqual({ dueOn, sats: 100, amount: null });
    const bitcoin = summarizeLoans(
      { sundayRest: false, loans: [loan({ next: { dueOn, sats: 100, amount: '3.00' } })] },
      'ch',
    );
    expect(bitcoin.next).toEqual({ dueOn, sats: 100, amount: null });
    const mixedBitcoin = summarizeLoans(
      {
        sundayRest: false,
        loans: [
          loan({ goalCurrency: 'PHP', next: { dueOn, sats: 40, amount: '2.00' } }),
          loan({ goalCurrency: 'BTC', next: { dueOn, sats: 60, amount: null } }),
        ],
      },
      'ch',
    );
    expect(mixedBitcoin.next).toEqual({ dueOn, sats: 100, amount: null });
  });
});

describe('definedFiatSum', () => {
  it('sums one fiat currency in cents and keeps the stored decimals', () => {
    expect(definedFiatSum('PHP', ['30.00', '1.50'], 'ch')).toBe('₱31.50');
    expect(definedFiatSum('USD', ['10.125'], 'us')).toBe('$10.13');
  });

  it('is null for bitcoin, a missing code or amount, an empty list, or an invalid amount', () => {
    expect(definedFiatSum('BTC', ['1.00'], 'ch')).toBeNull();
    expect(definedFiatSum(undefined, ['1.00'], 'ch')).toBeNull();
    expect(definedFiatSum('PHP', ['1.00', null], 'ch')).toBeNull();
    expect(definedFiatSum('PHP', ['not-an-amount'], 'ch')).toBeNull();
    expect(definedFiatSum('PHP', [], 'ch')).toBeNull();
  });
});

describe('definedFiatAmounts', () => {
  it('sums each currency and keeps first-seen currency order', () => {
    expect(
      definedFiatAmounts(
        [
          { code: 'PHP', amount: '1.00' },
          { code: 'USD', amount: '2.00' },
          { code: 'PHP', amount: '1.50' },
        ],
        'ch',
      ),
    ).toBe('₱2.50 + $2.00');
  });

  it('is null when any part is bitcoin, missing, invalid, or the list is empty', () => {
    expect(definedFiatAmounts([], 'ch')).toBeNull();
    expect(definedFiatAmounts([{ code: 'BTC', amount: '1.00' }], 'ch')).toBeNull();
    expect(definedFiatAmounts([{ code: 'PHP', amount: null }], 'ch')).toBeNull();
    expect(definedFiatAmounts([{ code: 'PHP', amount: 'not-an-amount' }], 'ch')).toBeNull();
  });
});

describe('dueShares', () => {
  it('validates partial sats and integer fiat cents against their originals', () => {
    expect(
      validatedRepaymentPayment({
        sats: 500,
        paidSats: 500,
        amount: '1.00',
        paidAmount: '1.00',
      }),
    ).toEqual({ sats: 500n, amount: 100n, hasAmount: true });
    expect(
      validatedRepaymentPayment({
        sats: 500,
        paidSats: 501,
        amount: '1.00',
        paidAmount: '1.00',
      }),
    ).toEqual({ sats: null, amount: null, hasAmount: true });
    expect(
      validatedRepaymentPayment({
        sats: 500,
        paidSats: 100,
        amount: '1.00',
        paidAmount: '1.001',
      }),
    ).toEqual({ sats: 100n, amount: null, hasAmount: true });
    expect(
      validatedRepaymentPayment({
        sats: 500,
        paidSats: 100,
        amount: '1.00',
        paidAmount: '1.01',
      }),
    ).toEqual({ sats: 100n, amount: null, hasAmount: true });
  });

  it('keeps zero defaults separate from unknown partial relationships', () => {
    expect(
      validatedRepaymentPayment({
        sats: null,
        amount: '1.00',
      }),
    ).toEqual({ sats: 0n, amount: 0n, hasAmount: false });
    expect(
      validatedRepaymentPayment({
        sats: null,
        paidSats: 1,
        amount: null,
        paidAmount: null,
      }),
    ).toEqual({ sats: null, amount: null, hasAmount: false });
    expect(
      validatedRepaymentPayment({
        sats: 500,
        paidSats: 100,
        amount: '1.00',
        paidAmount: null,
      }),
    ).toEqual({ sats: 100n, amount: null, hasAmount: false });
  });

  it.each([
    ['fractional paid sats', 500, 0.5],
    ['negative paid sats', 500, -1],
    ['fractional original sats', 500.5, 1],
  ] as const)('rejects %s', (_case, sats, paidSats) => {
    expect(
      validatedRepaymentPayment({
        sats,
        paidSats,
        amount: null,
        paidAmount: null,
      }),
    ).toEqual({ sats: null, amount: null, hasAmount: false });
  });

  it('derives and validates the remaining sats when an older api omits dueSats', () => {
    const partial = { sats: 500, paidSats: 100, dueSats: null };
    expect(remainingRepaymentSats(partial)).toBe(400);
    expect(remainingRepaymentSats({ ...partial, dueSats: 375 })).toBe(375);
    expect(remainingRepaymentSats({ ...partial, paidSats: 501 })).toBeNull();
    expect(remainingRepaymentSats({ ...partial, sats: null })).toBeNull();
  });

  it('uses the derived remaining sats for a due row without dueSats', () => {
    const partial = {
      ...ledger().repayments[0]!,
      sats: 500,
      paidSats: 100,
      dueSats: null,
    };
    expect(dueShares([loan()], [ledger({ repayments: [partial] })])).toEqual([
      expect.objectContaining({ sats: 400 }),
    ]);
  });

  it('uses the remaining sats of a partially paid BTC due row', () => {
    expect(dueShares([loanClosedPartial], [ledgerClosedPartial])).toEqual([
      expect.objectContaining({ sats: 400, amount: null }),
    ]);
  });

  it('keeps overpaid satoshi and fiat due-share relationships unavailable', () => {
    const overpaidSats = {
      ...ledgerClosedPartial,
      repayments: [
        {
          ...ledgerClosedPartial.repayments[0]!,
          paidSats: 501,
        },
      ],
    };
    expect(dueShares([loanClosedPartial], [overpaidSats])).toEqual([
      expect.objectContaining({ sats: null, amount: null }),
    ]);

    const fiatLoan = loan({
      ...loanClosedPartial,
      goalCurrency: 'PHP',
      goalAmount: '200.00',
      maxAmount: '197.50',
    });
    const overpaidFiat = {
      ...ledgerClosedPartialFiat,
      repayments: [
        {
          ...ledgerClosedPartialFiat.repayments[0]!,
          amount: '1.00',
          paidAmount: '1.01',
        },
      ],
    };
    expect(dueShares([fiatLoan], [overpaidFiat])).toEqual([
      expect.objectContaining({ sats: 400, amount: null }),
    ]);
  });

  it('uses remaining cents after paidAmount for a partially paid fiat due row', () => {
    const fiatLoan = loan({
      ...loanClosedPartial,
      goalCurrency: 'PHP',
      goalAmount: '200.00',
      maxAmount: '197.50',
    });
    expect(dueShares([fiatLoan], [ledgerClosedPartialFiat])).toEqual([
      expect.objectContaining({ sats: 400, amount: '10.00' }),
    ]);
  });

  it('omits a remaining fiat amount when the stored total or partial amount is unusable', () => {
    const fiatLoan = loan({ goalCurrency: 'PHP', goalAmount: '200.00', maxAmount: '197.50' });
    const base = ledger({
      currency: 'PHP',
      repayments: [
        {
          ...ledger().repayments[0]!,
          amount: 'bad total',
          paidAmount: '1.00',
        },
        {
          ...ledger().repayments[0]!,
          accountId: 'acc_2',
          amount: '10.00',
          paidAmount: 'bad partial',
        },
        {
          ...ledger().repayments[0]!,
          accountId: 'acc_3',
          amount: '10.00',
          paidAmount: '10.01',
        },
      ],
    });

    expect(dueShares([fiatLoan], [base]).map((row) => row.amount)).toEqual([null, null, null]);
  });

  it('does not treat a missing paidAmount as zero cents after positive paidSats', () => {
    const fiatLoan = loan({ goalCurrency: 'PHP', goalAmount: '200.00', maxAmount: '197.50' });
    const withoutPaidAmount = {
      ...ledger().repayments[0]!,
      amount: '10.00',
      paidSats: 50,
    };
    delete withoutPaidAmount.paidAmount;
    const withoutPaidFields = { ...withoutPaidAmount };
    Reflect.deleteProperty(withoutPaidFields, 'paidSats');
    const base = ledger({
      currency: 'PHP',
      repayments: [
        { ...ledger().repayments[0]!, amount: '10.00', paidSats: 50, paidAmount: null },
        { ...withoutPaidAmount, accountId: 'acc_2' },
        {
          ...withoutPaidAmount,
          accountId: 'acc_3',
          paidSats: 0,
        },
        { ...withoutPaidFields, accountId: 'acc_4' },
      ],
    });

    expect(dueShares([fiatLoan], [base]).map((row) => row.amount)).toEqual([
      null,
      null,
      '10.00',
      '10.00',
    ]);
  });

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
        waiting: false,
      }),
      expect.objectContaining({
        messageId: 'm2',
        loanIndex: 1,
        dayIndex: 1,
        name: 'Cara',
        sats: 100,
        waiting: true,
      }),
      expect.objectContaining({
        messageId: 'm2',
        loanIndex: 1,
        dayIndex: 1,
        name: 'Diego',
        sats: 100,
        waiting: true,
      }),
      expect.objectContaining({
        messageId: 'm1',
        loanIndex: 0,
        dayIndex: 2,
        name: 'Bruno',
        sats: 90,
        amount: null,
        waiting: true,
      }),
    ]);
  });

  it("takes the api's waiting flag over the giver's availability", () => {
    const flagged = ledger({
      repayments: [
        { ...ledger().repayments[0]!, waiting: false },
        { ...ledger().repayments[0]!, dayIndex: 3, waiting: true },
      ],
    });
    const listed = ledger({
      givers: [{ ...ledger().givers[0]!, canReceive: true }],
      repayments: [{ ...ledger().repayments[0]!, waiting: true }],
    });
    expect(
      dueShares([loan(), loan({ messageId: 'm2' })], [flagged, listed]).map(
        (share) => share.waiting,
      ),
    ).toEqual([false, true, true]);
  });

  it('treats a missing matching ledger as empty', () => {
    expect(dueShares([loan()], [])).toEqual([]);
  });

  it('keeps no amount when the ledger currency differs from the loan currency', () => {
    const phpLoan = loan({ goalCurrency: 'PHP', goalAmount: '900.00' });
    const usdLedger = ledger({
      currency: 'USD',
      repayments: [{ ...ledger().repayments[0]!, amount: '1.00', sats: 90 }],
    });
    expect(dueShares([phpLoan], [usdLedger])).toEqual([
      expect.objectContaining({ amount: null, sats: 90 }),
    ]);
  });
});

describe('fittingPrefix', () => {
  it('stops before the first over-budget or unknown item without skipping', () => {
    expect(fittingPrefix([2, 3, 1], (value) => value, 4)).toEqual([2]);
    expect(fittingPrefix([1, 2, 3], (value) => (value === 2 ? null : value), 10)).toEqual([1]);
    expect(fittingPrefix([0, 1], (value) => value, 1)).toEqual([0, 1]);
  });
});

describe('centsString', () => {
  it('writes two decimals', () => {
    expect(centsString(3000n)).toBe('30.00');
    expect(centsString(5n)).toBe('0.05');
    expect(centsString(123_456n)).toBe('1234.56');
  });
});

describe('definedDueLabel', () => {
  const php = (payable: string | null, waiting: string | null): MyLoan =>
    loan({
      goalCurrency: 'PHP',
      due: {
        ...loan().due,
        payableSats: 300,
        payableAmount: payable,
        waitingSats: 20,
        waitingAmount: waiting,
      },
    });

  it('sums the stored figures of one fiat currency', () => {
    expect(definedDueLabel([php('30.00', '1.50'), php('0.05', '2.00')], 'waiting', 'ch')).toBe(
      '₱3.50',
    );
    expect(definedDueLabel([php('30.00', '1.50'), php('0.05', '2.00')], 'payable', 'ch')).toBe(
      '₱30.05',
    );
  });

  it('ignores loans with nothing in that part', () => {
    const none = loan({ due: { ...loan().due, waitingSats: 0, waitingAmount: null } });
    expect(definedDueLabel([none, php('30.00', '1.50')], 'waiting', 'ch')).toBe('₱1.50');
  });

  it('sums each fiat currency and joins the payable or waiting totals', () => {
    const usd = loan({
      goalCurrency: 'USD',
      due: { ...loan().due, payableAmount: '3.00', waitingAmount: '0.50' },
    });
    expect(definedDueLabel([php('30.00', '1.50'), usd], 'payable', 'ch')).toBe('₱30.00 + $3.00');
    expect(definedDueLabel([php('30.00', '1.50'), usd], 'waiting', 'ch')).toBe('₱1.50 + $0.50');
  });

  it('is null for bitcoin, a missing amount, or nothing due', () => {
    expect(definedDueLabel([loan()], 'waiting', 'ch')).toBeNull();
    expect(
      definedDueLabel([php('30.00', '1.50'), loan({ goalCurrency: 'USD' })], 'waiting', 'ch'),
    ).toBeNull();
    expect(definedDueLabel([php('30.00', null)], 'waiting', 'ch')).toBeNull();
    expect(definedDueLabel([], 'payable', 'ch')).toBeNull();
  });
});
