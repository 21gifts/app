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
import type { WalletPayResult } from '@/lib/wallet/wallet-service';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

const HASH_A = 'aa'.repeat(32);
const HASH_B = 'bb'.repeat(32);
const PREIMAGE_A = '11'.repeat(32);

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
 * Builds tick deps whose calls all succeed unless a test replaces one.
 *
 * @param payouts - Rows the list answers.
 * @returns Tick deps with spies.
 */
function depsFor(payouts: FondPayout[]): Mocked<FondPayoutTickDeps> {
  return {
    session: 'sess',
    fetchFondPayouts: vi.fn(async () => ({ ok: true, payouts })),
    postFondPayoutInvoice: vi.fn(async (_session: string, id: string) => ({
      ok: true,
      invoice: {
        id,
        bolt11: `lnbc-${id}`,
        paymentHash: id === 'row-b' ? HASH_B : HASH_A,
      },
    })),
    postFondPayoutProof: vi.fn(async () => ({ ok: true })),
    payFromWallet: vi.fn(async () => confirmResult({ kind: 'paid' })),
    listWalletPayments: vi.fn(async () => []),
    sleep: vi.fn(async () => undefined),
  } as Mocked<FondPayoutTickDeps>;
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

beforeEach(async () => {
  vi.resetModules();
  tick = (await import('@/lib/wallet/fond-payouts')).runFondPayoutTick;
});

describe('runFondPayoutTick list failures', () => {
  it('stops as off on 404 and forbidden on 403', async () => {
    const off = depsFor([]);
    vi.mocked(off.fetchFondPayouts).mockResolvedValue(failure(404));
    await expect(tick(off)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'off',
    });
    const forbidden = depsFor([]);
    vi.mocked(forbidden.fetchFondPayouts).mockResolvedValue(failure(403));
    await expect(tick(forbidden)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: 'forbidden',
    });
  });

  it('returns quietly on any other list failure so the next tick retries', async () => {
    const deps = depsFor([]);
    vi.mocked(deps.fetchFondPayouts).mockResolvedValue(failure(503));
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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

describe('runFondPayoutTick rows', () => {
  it('pays a fresh invoice and posts the polled preimage', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sentPayment({ status: 'pending' })])
      .mockResolvedValue([
        sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
      ]);
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
      paid: 1,
      proved: 1,
      skipped: 0,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
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
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('pays a completed send whose preimage is not readable or not 64-hex', async () => {
    for (const info of [{ paymentHash: HASH_A }, { paymentHash: HASH_A, preimage: 'not-hex' }]) {
      const deps = depsFor([OWED]);
      vi.mocked(deps.listWalletPayments)
        .mockResolvedValueOnce([sentPayment({ info })])
        .mockResolvedValue([sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } })]);
      await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
        paid: 1,
        proved: 1,
        skipped: 0,
        stop: null,
      });
      expect(deps.payFromWallet).toHaveBeenCalledWith({ type: 'input', input: 'lnbc-row-a' });
    }
  });

  it('skips the row when history cannot be read', async () => {
    const deps = depsFor([OWED]);
    vi.mocked(deps.listWalletPayments).mockRejectedValue(new Error('wallet-connect'));
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.payFromWallet).not.toHaveBeenCalled();
  });

  it('stops the whole tick when prepare or send reports no balance', async () => {
    const preparer = depsFor([OWED, OWED_B]);
    vi.mocked(preparer.payFromWallet).mockResolvedValue({ kind: 'insufficient', failure: {} as never });
    await expect(tick(preparer)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(preparer.postFondPayoutInvoice).toHaveBeenCalledTimes(1);

    const sender = depsFor([OWED, OWED_B]);
    vi.mocked(sender.payFromWallet).mockResolvedValue({
      kind: 'confirm',
      amountSats: 10,
      feeSats: 0,
      method: 'lightning',
      send: vi.fn(async () => ({ kind: 'insufficient', failure: {} as never })),
    });
    await expect(tick(sender)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 0,
      stop: null,
    });
    expect(sender.postFondPayoutInvoice).toHaveBeenCalledTimes(1);
  });

  it('skips every other prepare and send outcome', async () => {
    const outcomes: WalletPayResult[] = [
      { kind: 'belowMinimum', minSats: 100, failure: {} as never },
      { kind: 'failed', failure: {} as never },
      { kind: 'unlock', failure: {} as never },
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => ({ kind: 'failed', failure: {} as never })),
      },
      {
        kind: 'confirm',
        amountSats: 10,
        feeSats: 0,
        method: 'lightning',
        send: vi.fn(async () => ({ kind: 'expired', failure: {} as never })),
      },
    ];
    for (const outcome of outcomes) {
      const deps = depsFor([OWED]);
      vi.mocked(deps.payFromWallet).mockResolvedValue(outcome);
      await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(preparer)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });

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
    await expect(tick(sender)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
  });

  it('skips a row whose preimage never appears, so the next tick finds it', async () => {
    const deps = depsFor([OWED]);
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
  });

  it('skips a settling row this tab does not remember', async () => {
    const deps = depsFor([SETTLING]);
    await expect(tick(deps)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(deps.postFondPayoutInvoice).not.toHaveBeenCalled();
  });

  it('finishes a settling row this tab invoiced earlier, from its remembered hash', async () => {
    const first = depsFor([OWED]);
    await tick(first);
    const second = depsFor([SETTLING]);
    vi.mocked(second.listWalletPayments).mockResolvedValue([
      sentPayment({ info: { paymentHash: HASH_A, preimage: PREIMAGE_A } }),
    ]);
    await expect(tick(second)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(second)).resolves.toEqual<FondPayoutTickResult>({
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
    await expect(tick(second)).resolves.toEqual<FondPayoutTickResult>({
      paid: 0,
      proved: 0,
      skipped: 1,
      stop: null,
    });
    expect(second.payFromWallet).not.toHaveBeenCalled();
  });
});
