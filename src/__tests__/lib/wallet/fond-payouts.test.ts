// @vitest-environment node
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { FondPayoutFailure } from '@/lib/api';
import type { FondPayout } from '@/lib/api-types';
import {
  runFondPayoutTick,
  waitForFondPayoutRead,
  type FondPayoutTickDeps,
  type FondPayoutTickResult,
} from '@/lib/wallet/fond-payouts';
import type { PaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletPayResult, WalletSendResult } from '@/lib/wallet/wallet-service';
import type { WalletPayment, WalletPayRequest } from '@/lib/wallet/wallet-sdk';

vi.mock('@/lib/wallet/payment-failure', () => ({ reportPaymentFailure: vi.fn() }));

const HASH_A = 'aa'.repeat(32);
const HASH_B = 'bb'.repeat(32);
const PREIMAGE_A = '11'.repeat(32);
const PREIMAGE_B = '22'.repeat(32);
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
    method: 'lightning',
    senderComment: null,
    info: { paymentHash: HASH_A, invoice: 'lnbc1a', preimage: PREIMAGE_A },
    ...overrides,
  };
}

/**
 * A confirmed prepare result.
 *
 * @param sent - Result of `send`.
 * @returns The prepare result.
 */
function confirmResult(sent: { kind: 'paid' }): WalletPayResult {
  return {
    kind: 'confirm',
    amountSats: 10,
    feeSats: 0,
    method: 'lightning',
    send: vi.fn(async () => sent),
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
          bolt11: `lnbc-${id}`,
          paymentHash: id === 'row-b' ? HASH_B : HASH_A,
        },
      }),
    ),
    postFondPayoutProof: vi.fn<FondPayoutTickDeps['postFondPayoutProof']>(
      async (_session: string, _id: string, _preimage: string) => ({ ok: true }),
    ),
    payFromWallet: vi.fn<FondPayoutTickDeps['payFromWallet']>(async (_request: WalletPayRequest) =>
      confirmResult({ kind: 'paid' }),
    ),
    listWalletPayments: vi.fn<FondPayoutTickDeps['listWalletPayments']>(
      async (_page: { offset: number; limit: number }) => [] as WalletPayment[],
    ),
    sleep: vi.fn<FondPayoutTickDeps['sleep']>(async (_ms: number) => undefined),
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
let report: typeof import('@/lib/wallet/payment-failure').reportPaymentFailure;

beforeEach(async () => {
  vi.resetModules();
  const failureModule = await import('@/lib/wallet/payment-failure');
  report = failureModule.reportPaymentFailure;
  vi.mocked(report).mockClear();
  const fondPayouts = await import('@/lib/wallet/fond-payouts');
  tick = fondPayouts.runFondPayoutTick;
  tickOnce = fondPayouts.runFondPayoutTickOnce;
});

describe('runFondPayoutTick list failures', () => {
  it('stops as off on 404 and forbidden on 403', async () => {
    const off = depsFor([]);
    vi.mocked(off.fetchFondPayouts).mockResolvedValue(failure(404));
    await expect(tick(off)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'off',
    });
    const forbidden = depsFor([]);
    vi.mocked(forbidden.fetchFondPayouts).mockResolvedValue(failure(403));
    await expect(tick(forbidden)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
  });

  it('returns quietly on any other list failure so the next tick retries', async () => {
    const deps = depsFor([]);
    vi.mocked(deps.fetchFondPayouts).mockResolvedValue(failure(503));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
  });
});

describe('waitForFondPayoutRead', () => {
  it('resolves after the given wait', async () => {
    vi.useFakeTimers();
    let done = false;
    const waiting = waitForFondPayoutRead(2_000).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    await waiting;
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});

describe('runFondPayoutTickOnce', () => {
  it('shares one tick while it is in flight', async () => {
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
    await expect(firstRun).resolves.toEqual({ paid: 0, proved: 0, skipped: 0, stop: null });
    await expect(secondRun).resolves.toEqual({ paid: 0, proved: 0, skipped: 0, stop: null });
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
    await expect(tickOnce(retry)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(retry.fetchFondPayouts).toHaveBeenCalledTimes(1);
  });
});

describe('runFondPayoutTick rows', () => {
  it('pays a fresh invoice and posts the polled preimage', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sentPayment({ status: 'pending', info: { paymentHash: HASH_A } })])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledWith('sess', 'row-a');
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc-row-a' });
    expect(deps.sleep).toHaveBeenCalledTimes(2);
    expect(deps.sleep).toHaveBeenCalledWith(2_000);
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it('handles rows in list order, one at a time', async () => {
    const deps = depsFor([OWED, OWED_B]);
    const order: string[] = [];
    vi.mocked(deps.postFondPayoutInvoice).mockImplementation(async (_session, id) => {
      order.push(`invoice:${id}`);
      return {
        ok: true,
        invoice: { id, bolt11: `lnbc-${id}`, paymentHash: id === 'row-b' ? HASH_B : HASH_A },
      };
    });
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    await tick(deps);
    expect(order).toEqual(['invoice:row-a', 'invoice:row-b']);
  });

  it('skips a row whose invoice is not payable now', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(409, 'Invoice in progress'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('stops as forbidden on an invoice 403', async () => {
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(403, 'Fond only'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips an invoice 404 because that row is gone', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.postFondPayoutInvoice).mockResolvedValue(failure(404, 'Not found'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('proves a completed send without paying again', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A.toUpperCase(), preimage: PREIMAGE_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it("does not treat a received payment as the row's send", async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([
        sentPayment({
          direction: 'received',
          info: { paymentHash: HASH_A, preimage: PREIMAGE_B },
        }),
      ])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.payFromWallet).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc-row-a' });
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it('matches an earlier send by its BOLT11 when the hash is absent', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { invoice: 'lnbc-row-a', preimage: PREIMAGE_A } }),
    ]);
    await tick(deps);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it('never pays a pending send again', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([sentPayment({ status: 'pending' })]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('skips a completed send whose preimage is not readable or not 64-hex', async () => {
    for (const info of [{ paymentHash: HASH_A }, { paymentHash: HASH_A, preimage: 'not-hex' }]) {
      const deps = depsFor([OWED]);
      vi.mocked(deps.listWalletPayments).mockResolvedValue([sentPayment({ info })]);
      await expect(tick(deps)).resolves.toEqual({
        paid: 0,
        proved: 0,
        skipped: 1,
        stop: null,
      });
      expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
      expect(deps.payFromWallet).not.toHaveBeenCalled();
      expect(deps.postFondPayoutProof).not.toHaveBeenCalled();
    }
  });

  it('skips a row while its timed-out send is unresolved', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => failedLate(sentLate)),
    });
    await expect(tick(first)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(report).toHaveBeenCalledWith(TIMEOUT, 'fond_payout', {
      session: 'sess',
      sentLate,
    });

    const second = depsFor([OWED]);
    await expect(tick(second)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(second.postFondPayoutInvoice).not.toHaveBeenCalled();
    expect(second.payFromWallet).not.toHaveBeenCalled();
    settle(true);
    await sentLate;
  });

  it('never pays a timed-out send the wallet confirms, only proves it from history', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => failedLate(sentLate)),
    });
    await tick(first);
    settle(true);
    await sentLate;
    await Promise.resolve();

    const second = depsFor([OWED]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    await expect(tick(second)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(second.payFromWallet).not.toHaveBeenCalled();
    expect(second.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it('pays again after a timed-out send the wallet rejects, and after one that rejects late', async () => {
    let settle: (sent: boolean) => void = () => undefined;
    const sentLate = new Promise<boolean>((resolve) => {
      settle = resolve;
    });
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => failedLate(sentLate)),
    });
    await tick(first);
    settle(false);
    await sentLate;

    const second = depsFor([OWED]);
    vi.mocked(second.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    await expect(tick(second)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(second.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc-row-a' });

    const rejectedLate = Promise.reject(new Error('wallet-connect'));
    rejectedLate.catch(() => undefined);
    const third = depsFor([OWED]);
    vi.mocked(third.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => failedLate(rejectedLate)),
    });
    await tick(third);
    await Promise.resolve();
    const fourth = depsFor([OWED]);
    vi.mocked(fourth.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    await expect(tick(fourth)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
  });

  it('forgets a timed-out send whose sentLate rejects', async () => {
    const rejectedLate = Promise.reject(new Error('wallet-connect'));
    rejectedLate.catch(() => undefined);
    const first = depsFor([OWED]);
    vi.mocked(first.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => failedLate(rejectedLate)),
    });
    await tick(first);
    await Promise.resolve();
    const second = depsFor([OWED]);
    vi.mocked(second.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    await expect(tick(second)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
  });

  it('skips the row when history cannot be read', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockRejectedValue(new Error('wallet-connect'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('stops the whole tick when prepare or send reports no balance', async () => {
    const preparer = depsFor([OWED, OWED_B]);
    vi.mocked(preparer.payFromWallet).mockResolvedValue({ kind: 'insufficient', failure: FAILURE });
    await expect(tick(preparer)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(preparer.postFondPayoutInvoice).toHaveBeenCalledTimes(1);

    const sender = depsFor([OWED, OWED_B]);
    const insufficient: WalletSendResult = { kind: 'insufficient', failure: FAILURE };
    vi.mocked(sender.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => insufficient),
    });
    await expect(tick(sender)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(sender.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
  });

  it('skips every other prepare and send outcome', async () => {
    const failed: WalletSendResult = { kind: 'failed', failure: FAILURE };
    const expired: WalletSendResult = { kind: 'expired', failure: FAILURE };
    const outcomes: WalletPayResult[] = [
      { kind: 'belowMinimum', minSats: 100, failure: FAILURE },
      { kind: 'failed', failure: FAILURE },
      { kind: 'unlock', failure: FAILURE },
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => failed),
      },
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => expired),
      },
    ];
    for (const outcome of outcomes) {
      const deps = depsFor([OWED]);
      vi.mocked(deps.payFromWallet).mockResolvedValue(outcome);
      await expect(tick(deps)).resolves.toEqual({
        paid: 0,
        proved: 0,
        skipped: 1,
        stop: null,
      });
    }
  });

  it('skips the row when prepare or send throws', async () => {
    const preparer = depsFor([OWED]);
    vi.mocked(preparer.payFromWallet).mockRejectedValue(new Error('boom'));
    await expect(tick(preparer)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'prepare', reason: 'sdk_error' }),
      'fond_payout',
      { session: 'sess' },
    );

    const sender = depsFor([OWED]);
    vi.mocked(sender.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await expect(tick(sender)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
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
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => ({ kind: 'failed', failure: FAILURE }) as WalletSendResult),
      },
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => ({ kind: 'expired', failure: FAILURE }) as WalletSendResult),
      },
    ];
    for (const outcome of outcomes) {
      vi.mocked(report).mockClear();
      const deps = depsFor([OWED]);
      vi.mocked(deps.payFromWallet).mockResolvedValue(outcome);
      await tick(deps);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(FAILURE, 'fond_payout', {
        session: 'sess',
      });
    }
  });

  it('skips a row whose preimage never appears, so the next tick finds it', async () => {
    const deps = depsFor([OWED]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.sleep).toHaveBeenCalledTimes(5);
    expect(deps.postFondPayoutProof).not.toHaveBeenCalled();
  });

  it('skips a row when the history read fails while it waits for a preimage', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockRejectedValue(new Error('wallet-connect'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
  });

  it('skips a row whose proof is refused', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    vi.mocked(deps.postFondPayoutProof).mockResolvedValue(failure(409, 'Proof in progress'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
  });

  it('stops as forbidden on a proof 403', async () => {
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    vi.mocked(deps.postFondPayoutProof).mockResolvedValue(failure(403, 'Fond only'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
    expect(deps.postFondPayoutProof).toHaveBeenCalledTimes(1);
  });

  it('skips a proof 404 because that row is gone', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    vi.mocked(deps.postFondPayoutProof).mockResolvedValue(failure(404, 'Not found'));
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
  });

  it('skips a settling row this tab does not remember', async () => {
    const deps = depsFor([SETTLING]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).not.toHaveBeenCalled();
  });

  it('proves a settling row from the list payment hash without paying', async () => {
    const deps = depsFor([{ ...SETTLING, paymentHash: HASH_B }]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_B, preimage: PREIMAGE_B } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).not.toHaveBeenCalled();
    expect(deps.payFromWallet).not.toHaveBeenCalled();
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_B);
  });

  it('finishes a settling row this tab invoiced earlier, from its remembered hash', async () => {
    const first = depsFor([OWED]);
    await tick(first);
    const second = depsFor([SETTLING]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    await expect(tick(second)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(second.postFondPayoutInvoice).not.toHaveBeenCalled();
  });

  it('leaves a remembered settling row alone until its send has a preimage', async () => {
    const first = depsFor([OWED]);
    await tick(first);
    const second = depsFor([SETTLING]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([
      sentPayment({ status: 'pending', info: { paymentHash: HASH_A } }),
    ]);
    await expect(tick(second)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(second.payFromWallet).not.toHaveBeenCalled();
  });

  it('leaves a remembered settling row alone with no matching send', async () => {
    const first = depsFor([OWED]);
    vi.mocked(first.listWalletPayments).mockResolvedValue([]);
    await tick(first);
    const second = depsFor([SETTLING]);
    vi.mocked(second.payFromWallet).mockResolvedValue(confirmResult({ kind: 'paid' }));
    await expect(tick(second)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(second.payFromWallet).not.toHaveBeenCalled();
  });

  it('returns before the list when already cancelled', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockReturnValue(true);
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(deps.fetchFondPayouts).not.toHaveBeenCalled();
  });

  it('stops before the next row when cancelled', async () => {
    let cancelled = false;
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([]);
    vi.mocked(deps.payFromWallet).mockImplementation(async () => {
      cancelled = true;
      return confirmResult({ kind: 'paid' });
    });
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).toHaveBeenCalledTimes(1);
  });

  it('stops at the next row when cancelled after the first proof', async () => {
    let cancelled = false;
    const deps = depsFor([OWED, OWED_B]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
    vi.mocked(deps.postFondPayoutProof).mockImplementation(async () => {
      cancelled = true;
      return { ok: true };
    });
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.postFondPayoutInvoice).not.toHaveBeenCalledWith('sess', 'row-b');
  });

  it('does not pay when cancelled before payFromWallet', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.postFondPayoutInvoice).mockImplementation(async (_session, id) => {
      cancelled = true;
      return { ok: true, invoice: { id, bolt11: `lnbc-${id}`, paymentHash: HASH_A } };
    });
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('does not post a proof when cancelled before it', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.listWalletPayments).mockImplementation(async () => {
      cancelled = true;
      return [sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })];
    });
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutProof).not.toHaveBeenCalled();
  });

  it('does not pay when a completed send appears after the invoice request', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    await expect(tick(deps)).resolves.toEqual({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
    expect(deps.payFromWallet).not.toHaveBeenCalled();
    expect(deps.postFondPayoutProof).toHaveBeenCalledWith('sess', 'row-a', PREIMAGE_A);
  });

  it('cancels while it waits for a fresh preimage', async () => {
    let cancelled = false;
    const deps = depsFor([OWED]);
    vi.mocked(deps.isCancelled).mockImplementation(() => cancelled);
    vi.mocked(deps.sleep).mockImplementation(async () => {
      cancelled = true;
    });
    await expect(tick(deps)).resolves.toEqual({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(deps.sleep).toHaveBeenCalledTimes(1);
    expect(deps.postFondPayoutProof).not.toHaveBeenCalled();
  });
});
