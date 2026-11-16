// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { FondPayoutFailure } from '@/lib/api';
import type { FondPayout } from '@/lib/api-types';
import {
  runFondPayoutTick,
  type FondPayoutTickDeps,
  type FondPayoutTickResult,
} from '@/lib/wallet/fond-payouts';
import type { PaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletPayResult, WalletSendResult } from '@/lib/wallet/wallet-service';
import type { WalletPayment, WalletPayRequest } from '@/lib/wallet/wallet-sdk';

vi.mock('@/lib/wallet/payment-failure', () => ({ reportPaymentFailure: vi.fn() }));

const HASH_A = 'aa'.repeat(32);
const HASH_B = 'bb'.repeat(32);
const BOLT_A = 'lnbc-row-a';
const BOLT_B = 'lnbc-row-b';
const SPARK_A = 'spark-row-a';
const SPARK_B = 'spark-row-b';
const FAILURE: PaymentFailure = {
  stage: 'prepare',
  reason: 'sdk_error',
  method: 'lightning',
  amountSats: null,
  feeSats: null,
};
const TIMEOUT: PaymentFailure = { ...FAILURE, stage: 'send', reason: 'timeout' };

const OWED: FondPayout = { id: 'row-a', kind: 'daily', status: 'owed', utcDay: '2026-11-10' };
const OWED_B: FondPayout = { id: 'row-b', kind: 'moderator', status: 'owed', utcDay: '2026-11-10' };
const SETTLING: FondPayout = {
  id: 'row-a',
  kind: 'welcome',
  status: 'settling',
  utcDay: '2026-11-10',
};

/**
 * One sent wallet payment for a payout.
 *
 * @param overrides - Fields to replace.
 * @returns The payment.
 */
function sentPayment(overrides: Partial<WalletPayment> = {}): WalletPayment {
  return {
    id: 'pay-1',
    direction: 'sent',
    amountSats: 10,
    feesSats: 0,
    timestamp: 1,
    status: 'completed',
    method: 'spark',
    senderComment: null,
    info: { paymentHash: HASH_A, invoice: SPARK_A },
    ...overrides,
  };
}

/**
 * A confirmed prepare result.
 *
 * @param send - Result of `send`.
 * @returns The prepare result.
 */
function confirmResult(send: () => Promise<WalletSendResult>): WalletPayResult {
  return {
    kind: 'confirm',
    amountSats: 10,
    feeSats: 0,
    method: 'spark',
    send: vi.fn(send),
  };
}

/**
 * A timed-out send whose late outcome the wallet still owes.
 *
 * @param sentLate - Promise of the wallet's late outcome.
 * @returns The failed send.
 */
function failedLate(sentLate: Promise<boolean>): WalletSendResult {
  return { kind: 'failed', failure: TIMEOUT, sentLate };
}

/**
 * Builds tick deps whose calls all succeed unless a test replaces one.
 *
 * @param payouts - Rows the list answers.
 * @returns Tick deps with spies.
 */
function depsFor(payouts: FondPayout[]): Mocked<FondPayoutTickDeps> {
  return {
    session: 'sess',
    isCancelled: vi.fn<() => boolean>(() => false),
    fetchFondPayouts: vi.fn<FondPayoutTickDeps['fetchFondPayouts']>(async (_session: string) => ({
      ok: true,
      payouts,
    })),
    postFondPayoutInvoice: vi.fn<FondPayoutTickDeps['postFondPayoutInvoice']>(
      async (_session: string, id: string) => ({
        ok: true,
        invoice: {
          id,
          bolt11: id === 'row-b' ? BOLT_B : BOLT_A,
          paymentHash: id === 'row-b' ? HASH_B : HASH_A,
          sparkInvoice: id === 'row-b' ? SPARK_B : SPARK_A,
        },
      }),
    ),
    payFromWallet: vi.fn<FondPayoutTickDeps['payFromWallet']>(async (_request: WalletPayRequest) =>
      confirmResult(async () => ({ kind: 'paid' })),
    ),
    listWalletPayments: vi.fn<FondPayoutTickDeps['listWalletPayments']>(
      async (_page: { offset: number; limit: number }) => [] as WalletPayment[],
    ),
  };
}

/**
 * A list failure.
 *
 * @param status - Failure status.
 * @param error - Failure text.
 * @returns The failure.
 */
function failure(status: number, error: string | null = null): FondPayoutFailure {
  return { ok: false, status, error };
}

let tick: typeof runFondPayoutTick;
let tickOnce: (deps: FondPayoutTickDeps) => Promise<FondPayoutTickResult>;
let e2eWallet: typeof import('@/lib/wallet/fond-payouts').fondE2eWallet;
let report: typeof import('@/lib/wallet/payment-failure').reportPaymentFailure;
const ORIGINAL_E2E_NOW = process.env.NEXT_PUBLIC_E2E_NOW;

afterEach(() => {
  if (ORIGINAL_E2E_NOW === undefined) {
    delete process.env.NEXT_PUBLIC_E2E_NOW;
  } else {
    process.env.NEXT_PUBLIC_E2E_NOW = ORIGINAL_E2E_NOW;
  }
});

beforeEach(async () => {
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_E2E_NOW;
  const failureModule = await import('@/lib/wallet/payment-failure');
  report = failureModule.reportPaymentFailure;
  vi.mocked(report).mockClear();
  const fondPayouts = await import('@/lib/wallet/fond-payouts');
  tick = fondPayouts.runFondPayoutTick;
  tickOnce = fondPayouts.runFondPayoutTickOnce;
  e2eWallet = fondPayouts.fondE2eWallet;
});

describe('runFondPayoutTick list failures', () => {
  it('stops as off on 404 and forbidden on 403', async () => {
    const off = depsFor([]);
    vi.mocked(off.fetchFondPayouts).mockResolvedValue(failure(404));
    await expect(tick(off)).resolves.toEqual({ paid: 0, skipped: 0, stop: 'off' });
    const forbidden = depsFor([]);
    vi.mocked(forbidden.fetchFondPayouts).mockResolvedValue(failure(403));
    await expect(tick(forbidden)).resolves.toEqual({ paid: 0, skipped: 0, stop: 'forbidden' });
  });

  it('returns quietly on any other list failure so the next tick retries', async () => {
    const deps = depsFor([]);
    vi.mocked(deps.fetchFondPayouts).mockResolvedValue(failure(503));
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
  });
});

describe('fondE2eWallet', () => {
  it('is inert outside a Playwright build', () => {
    expect(e2eWallet()).toBeNull();
  });

  it('has a fixed deposit address and one open deposit whose claim records the ceiling', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    const wallet = e2eWallet();
    expect(wallet).not.toBeNull();
    if (wallet === null) {
      return;
    }
    await expect(wallet.receiveBitcoinAddress()).resolves.toBe(
      'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr',
    );
    const [open] = await wallet.listUnclaimedDeposits();
    expect(open).toEqual({
      txid: 'cd'.repeat(32),
      vout: 0,
      amountSats: 50_000,
      done: false,
      maxClaimFeeSats: null,
    });
    await wallet.claimDeposit({ txid: 'cd'.repeat(32), vout: 0 }, 2_000);
    const [claimed] = await wallet.listUnclaimedDeposits();
    expect(claimed?.maxClaimFeeSats).toBe(2_000);
  });

  it('pays an input invoice and records it as a completed send', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    const wallet = e2eWallet();
    expect(wallet).not.toBeNull();
    if (wallet === null) {
      return;
    }
    await expect(wallet.listWalletPayments({ offset: 0, limit: 100 })).resolves.toEqual([]);
    const prepared = await wallet.payFromWallet({ type: 'input', input: SPARK_A });
    expect(prepared.kind).toBe('confirm');
    if (prepared.kind !== 'confirm') {
      return;
    }
    await expect(prepared.send()).resolves.toEqual({ kind: 'paid' });
    await expect(wallet.listWalletPayments({ offset: 0, limit: 100 })).resolves.toEqual([
      expect.objectContaining({
        direction: 'sent',
        status: 'completed',
        info: { invoice: SPARK_A },
      }),
    ]);
  });

  it('refuses a request that is not a pasted invoice', async () => {
    process.env.NEXT_PUBLIC_E2E_NOW = '2026-01-07T12:00:00.000Z';
    const wallet = e2eWallet();
    if (wallet === null) {
      throw new Error('expected the Playwright wallet');
    }
    await expect(
      wallet.payFromWallet({
        type: 'lnurl',
        request: { details: null },
        amountSats: 21,
      }),
    ).resolves.toMatchObject({ kind: 'failed', failure: { reason: 'sdk_error' } });
  });
});

describe('runFondPayoutTickOnce', () => {
  it('shares one tick with a caller of the same session while it is in flight', async () => {
    let release = (_value: { ok: true; payouts: FondPayout[] }): void => undefined;
    const gate = new Promise<{ ok: true; payouts: FondPayout[] }>((resolve) => {
      release = resolve;
    });
    const first = depsFor([]);
    vi.mocked(first.fetchFondPayouts).mockReturnValue(gate);
    const second = depsFor([]);

    const firstRun = tickOnce(first);
    const secondRun = tickOnce(second);

    expect(first.fetchFondPayouts).toHaveBeenCalledTimes(1);
    expect(second.fetchFondPayouts).not.toHaveBeenCalled();
    expect(secondRun).toBe(firstRun);

    release({ ok: true, payouts: [] });
    await expect(firstRun).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    await expect(secondRun).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
  });

  it('waits for a different session, then runs and returns its own tick', async () => {
    const order: string[] = [];
    let release = (_value: FondPayoutFailure): void => undefined;
    const gate = new Promise<FondPayoutFailure>((resolve) => {
      release = resolve;
    });
    const first = depsFor([]);
    first.session = 'sess-a';
    vi.mocked(first.fetchFondPayouts).mockImplementation(() => {
      order.push('a:start');
      return gate;
    });
    const second = depsFor([]);
    second.session = 'sess-b';
    vi.mocked(second.fetchFondPayouts).mockImplementation(async () => {
      order.push('b:start');
      return { ok: true, payouts: [] };
    });

    const firstRun = tickOnce(first);
    const secondRun = tickOnce(second);

    expect(secondRun).not.toBe(firstRun);
    expect(second.fetchFondPayouts).not.toHaveBeenCalled();
    expect(order).toEqual(['a:start']);

    release(failure(403, 'Fond only'));
    await expect(firstRun).resolves.toEqual({ paid: 0, skipped: 0, stop: 'forbidden' });
    await expect(secondRun).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(order).toEqual(['a:start', 'b:start']);
    expect(second.fetchFondPayouts).toHaveBeenCalledWith('sess-b');
  });

  it('starts a new tick after the first settled', async () => {
    const first = depsFor([]);
    const second = depsFor([]);

    await tickOnce(first);
    await tickOnce(second);

    expect(first.fetchFondPayouts).toHaveBeenCalledTimes(1);
    expect(second.fetchFondPayouts).toHaveBeenCalledTimes(1);
  });

  it('clears the guard after a throw', async () => {
    const failed = depsFor([]);
    vi.mocked(failed.fetchFondPayouts).mockRejectedValueOnce(new Error('boom'));

    await expect(tickOnce(failed)).rejects.toThrow('boom');

    const retry = depsFor([]);
    await expect(tickOnce(retry)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(retry.fetchFondPayouts).toHaveBeenCalledTimes(1);
  });

  it('starts the different session after the in-flight tick rejects', async () => {
    let reject = (_reason: Error): void => undefined;
    const gate = new Promise<{ ok: true; payouts: FondPayout[] }>((_resolve, rejectGate) => {
      reject = rejectGate;
    });
    const failed = depsFor([]);
    failed.session = 'sess-a';
    vi.mocked(failed.fetchFondPayouts).mockReturnValue(gate);
    const next = depsFor([]);
    next.session = 'sess-b';

    const failedRun = tickOnce(failed);
    const nextRun = tickOnce(next);
    expect(next.fetchFondPayouts).not.toHaveBeenCalled();

    reject(new Error('boom'));
    await expect(failedRun).rejects.toThrow('boom');
    await expect(nextRun).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(next.fetchFondPayouts).toHaveBeenCalledWith('sess-b');
  });
});

describe('runFondPayoutTick rows', () => {
  it('pays a fresh invoice with its Spark invoice', async () => {
    const deps = depsFor([OWED]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledWith('sess', 'row-a');
    expect(deps.listWalletPayments).toHaveBeenCalledWith({ offset: 0, limit: 100 });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('pays the BOLT11 when the api returns no Spark invoice', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue({
      ok: true,
      invoice: { id: 'row-a', bolt11: BOLT_A, paymentHash: HASH_A, sparkInvoice: null },
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: BOLT_A });
  });

  it('handles rows in list order, one at a time', async () => {
    const deps = depsFor([OWED, OWED_B]);
    const order: string[] = [];
    vi.mocked(deps.postFondPayoutInvoice).mockImplementation(async (_session, id) => {
      order.push(`invoice:${id}`);
      const rowB = id === 'row-b';
      return {
        ok: true,
        invoice: {
          id,
          bolt11: rowB ? BOLT_B : BOLT_A,
          paymentHash: rowB ? HASH_B : HASH_A,
          sparkInvoice: rowB ? SPARK_B : SPARK_A,
        },
      };
    });
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([sentPayment({ info: { paymentHash: HASH_A } })])
      .mockResolvedValueOnce([]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 1, stop: null });
    expect(order).toEqual(['invoice:row-a', 'invoice:row-b']);
  });

  it('skips a row whose invoice is not payable now', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(409, 'Invoice in progress'));
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('stops as forbidden on an invoice 403', async () => {
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(403, 'Fond only'));
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: 'forbidden' });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('keeps the paid count when a later invoice answers 403', async () => {
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.postFondPayoutInvoice).mockImplementation(async (_session, id) => {
      if (id === 'row-b') {
        return failure(403, 'Fond only');
      }
      return {
        ok: true,
        invoice: { id, bolt11: BOLT_A, paymentHash: HASH_A, sparkInvoice: SPARK_A },
      };
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: 'forbidden' });
    expect(deps.payFromWallet).toHaveBeenCalledTimes(1);
  });

  it('skips an invoice 404 because that row is gone', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(404, 'Not found'));
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips a completed send matched by payment hash without paying again', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A.toUpperCase() } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips a pending send matched by BOLT11 without paying again', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ status: 'pending', info: { invoice: BOLT_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips a completed send matched by the Spark invoice string', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { invoice: SPARK_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not treat an unmatched Spark invoice as this row', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { invoice: 'spark-other' } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('does not match on Spark when the api returned null', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue({
      ok: true,
      invoice: { id: 'row-a', bolt11: BOLT_A, paymentHash: HASH_A, sparkInvoice: null },
    });
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { invoice: SPARK_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: BOLT_A });
  });

  it('pays when only a failed send matches', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ status: 'failed', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('skips an older pending send after a newer failed send', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ id: 'pay-new', status: 'failed', info: { paymentHash: HASH_A } }),
      sentPayment({ id: 'pay-old', status: 'pending', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it("does not treat a received payment as the row's send", async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ direction: 'received', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('pays when a sent match carries neither a matching hash nor invoice', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_B } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('skips the row when history cannot be read', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockRejectedValue(new Error('wallet-connect'));
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips a settling row without asking for an invoice', async () => {
    const deps = depsFor([{ ...SETTLING, paymentHash: HASH_A }]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([sentPayment()]);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.postFondPayoutInvoice).not.toHaveBeenCalled();
    expect(deps.listWalletPayments).not.toHaveBeenCalled();
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('stops the whole tick when prepare or send reports no balance', async () => {
    const preparer = depsFor([OWED, OWED_B]);
    vi.mocked(preparer.payFromWallet).mockResolvedValue({ kind: 'insufficient', failure: FAILURE });
    await expect(tick(preparer)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(preparer.postFondPayoutInvoice).toHaveBeenCalledTimes(1);

    const sender = depsFor([OWED, OWED_B]);
    vi.mocked(sender.payFromWallet).mockResolvedValue(
      confirmResult(async () => ({ kind: 'insufficient', failure: FAILURE })),
    );
    await expect(tick(sender)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(sender.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
  });

  it('skips every other prepare and send outcome', async () => {
    const outcomes: WalletPayResult[] = [
      { kind: 'belowMinimum', minSats: 100, failure: FAILURE },
      { kind: 'failed', failure: FAILURE },
      { kind: 'unlock', failure: FAILURE },
      confirmResult(async () => ({ kind: 'failed', failure: FAILURE })),
      confirmResult(async () => ({ kind: 'expired', failure: FAILURE })),
    ];
    for (const outcome of outcomes) {
      const deps = depsFor([OWED]);
      vi.mocked(deps.payFromWallet).mockResolvedValue(outcome);
      await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    }
  });

  it('skips the row when prepare or send throws', async () => {
    const preparer = depsFor([OWED]);
    vi.mocked(preparer.payFromWallet).mockRejectedValue(new Error('boom'));
    await expect(tick(preparer)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'prepare', reason: 'sdk_error' }),
      'fond_payout',
      { session: 'sess' },
    );

    const sender = depsFor([OWED]);
    vi.mocked(sender.payFromWallet).mockResolvedValue(
      confirmResult(async () => {
        throw new Error('boom');
      }),
    );
    await expect(tick(sender)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'send', reason: 'sdk_error' }),
      'fond_payout',
      { session: 'sess' },
    );
  });

  it('reports every prepare and send outcome that did not go out once', async () => {
    const outcomes: WalletPayResult[] = [
      { kind: 'belowMinimum', minSats: 100, failure: FAILURE },
      { kind: 'failed', failure: FAILURE },
      { kind: 'unlock', failure: FAILURE },
      { kind: 'insufficient', failure: FAILURE },
      confirmResult(async () => ({ kind: 'failed', failure: FAILURE })),
      confirmResult(async () => ({ kind: 'expired', failure: FAILURE })),
    ];
    for (const outcome of outcomes) {
      vi.mocked(report).mockClear();
      const deps = depsFor([OWED]);
      vi.mocked(deps.payFromWallet).mockResolvedValue(outcome);
      await tick(deps);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(FAILURE, 'fond_payout', { session: 'sess' });
    }
  });

  it('skips a row while its timed-out send is unresolved', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(sentLate)),
    );
    await expect(tick(first)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(report).toHaveBeenCalledWith(TIMEOUT, 'fond_payout', { session: 'sess', sentLate });

    const second = depsFor([OWED]);
    await expect(tick(second)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(second.postFondPayoutInvoice).not.toHaveBeenCalled();
    expect(second.payFromWallet).not.toHaveBeenCalled();
    settle(true);
    await sentLate;
  });

  it('never pays a timed-out send the wallet confirms, even before history shows it', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(sentLate)),
    );
    await tick(first);
    settle(true);
    await sentLate;
    await Promise.resolve();

    const second = depsFor([OWED]);
    await expect(tick(second)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(second.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(second.payFromWallet).not.toHaveBeenCalled();

    const third = depsFor([OWED]);
    vi.mocked(third.listWalletPayments).mockResolvedValue([
      sentPayment({ status: 'pending', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(third)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(third.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not pay a confirmed late send even when the history has no match', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(sentLate)),
    );
    await tick(first);
    settle(true);
    await sentLate;
    await Promise.resolve();

    const second = depsFor([OWED]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([
      sentPayment({ status: 'failed', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(second)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(second.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not pay a row again after its own send left the history window', async () => {
    const first = depsFor([OWED]);
    await expect(tick(first)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });

    const second = depsFor([OWED]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([]);
    await expect(tick(second)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(second.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(second.payFromWallet).not.toHaveBeenCalled();
  });

  it('forgets a paid id once the list no longer returns it', async () => {
    const first = depsFor([OWED]);
    await expect(tick(first)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    await expect(tick(depsFor([]))).resolves.toEqual({ paid: 0, skipped: 0, stop: null });

    const relisted = depsFor([OWED]);
    await expect(tick(relisted)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(relisted.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
  });

  it('guards a forgotten id by its history when the row is listed again', async () => {
    await tick(depsFor([OWED]));
    await tick(depsFor([]));

    const relisted = depsFor([OWED]);
    vi.mocked(relisted.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(relisted)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(relisted.payFromWallet).not.toHaveBeenCalled();
  });

  it('pays again after a timed-out send the wallet rejects, and after a late reject', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(sentLate)),
    );
    await tick(first);
    settle(false);
    await sentLate;

    const second = depsFor([OWED]);
    await expect(tick(second)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
    expect(second.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: SPARK_A });
    await tick(depsFor([]));

    const rejectedLate = Promise.reject(new Error('wallet-connect'));
    rejectedLate.catch(() => undefined);
    const third = depsFor([OWED]);
    vi.mocked(third.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(rejectedLate)),
    );
    await tick(third);
    await Promise.resolve();
    const fourth = depsFor([OWED]);
    await expect(tick(fourth)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
  });

  it('forgets a timed-out send whose sentLate rejects', async () => {
    const rejectedLate = Promise.reject(new Error('wallet-connect'));
    rejectedLate.catch(() => undefined);
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue(
      confirmResult(async () => failedLate(rejectedLate)),
    );
    await tick(first);
    await Promise.resolve();
    const second = depsFor([OWED]);
    await expect(tick(second)).resolves.toEqual({ paid: 1, skipped: 0, stop: null });
  });

  it('returns before the list when already cancelled', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockReturnValue(true);
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(deps.fetchFondPayouts).not.toHaveBeenCalled();
  });

  it('stops before the next row when cancelled', async () => {
    let cancelled = false;
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.payFromWallet).mockImplementation(async () => {
      cancelled = true;
      return confirmResult(async () => ({ kind: 'paid' }));
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).toHaveBeenCalledTimes(1);
  });

  it('stops before the next row when cancellation follows a skipped row', async () => {
    let cancelled = false;
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.listWalletPayments).mockImplementation(async () => {
      cancelled = true;
      return [sentPayment({ info: { paymentHash: HASH_A } })];
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 1, stop: null });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not pay when cancelled before payFromWallet', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.listWalletPayments).mockImplementation(async () => {
      cancelled = true;
      return [];
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not send when cancelled after prepare', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    const send = vi.fn(async () => ({ kind: 'paid' }) as WalletSendResult);
    vi.mocked(deps.payFromWallet).mockImplementation(async () => {
      cancelled = true;
      return confirmResult(send);
    });
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports no paid row when cancelled after the send went out', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.payFromWallet).mockResolvedValue(
      confirmResult(async () => {
        cancelled = true;
        return { kind: 'paid' };
      }),
    );
    await expect(tick(deps)).resolves.toEqual({ paid: 0, skipped: 0, stop: null });
    expect(deps.payFromWallet).toHaveBeenCalledTimes(1);
  });
});
