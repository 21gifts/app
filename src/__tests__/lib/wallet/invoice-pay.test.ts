import { describe, expect, it, vi } from 'vitest';
import { payInvoiceSparkFirst } from '@/lib/wallet/invoice-pay';
import type { PaymentFailure, PayReason } from '@/lib/wallet/payment-failure';
import type { WalletPayResult } from '@/lib/wallet/wallet-service';
import type { WalletPayRequest } from '@/lib/wallet/wallet-sdk';

const SPARK = 'spark1invoice';
const PR = 'lnbc210n1invoice';

function refused(reason: PayReason): PaymentFailure {
  return { stage: 'prepare', reason, method: 'spark', amountSats: null, feeSats: null };
}

function confirm(feeSats: number): WalletPayResult {
  return {
    kind: 'confirm',
    amountSats: 21,
    feeSats,
    method: feeSats === 0 ? 'spark' : 'lightning',
    send: async () => ({ kind: 'paid' }),
  };
}

/**
 * A wallet prepare that answers the Spark invoice with `spark` and the payment
 * request with a 2-sat Lightning confirmation.
 */
function walletWith(
  spark: WalletPayResult,
): ReturnType<typeof vi.fn<(request: WalletPayRequest) => Promise<WalletPayResult>>> {
  return vi.fn(async (request: WalletPayRequest) =>
    request.type === 'input' && request.input === SPARK ? spark : confirm(2),
  );
}

describe('payInvoiceSparkFirst', () => {
  it('prepares only the Spark invoice when the wallet takes it, without a fee', async () => {
    const pay = walletWith(confirm(0));
    const onSparkFailure = vi.fn();
    const result = await payInvoiceSparkFirst(pay, { sparkInvoice: SPARK, pr: PR }, onSparkFailure);
    expect(result).toMatchObject({ kind: 'confirm', feeSats: 0, method: 'spark' });
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith({ type: 'input', input: SPARK });
    expect(onSparkFailure).not.toHaveBeenCalled();
  });

  it('prepares the payment request at once without a Spark invoice', async () => {
    for (const sparkInvoice of [null, undefined, '']) {
      const pay = walletWith(confirm(0));
      const result = await payInvoiceSparkFirst(pay, { sparkInvoice, pr: PR });
      expect(result).toMatchObject({ kind: 'confirm', feeSats: 2 });
      expect(pay).toHaveBeenCalledTimes(1);
      expect(pay).toHaveBeenCalledWith({ type: 'input', input: PR });
    }
  });

  it('falls back to the payment request when the wallet refuses the Spark invoice', async () => {
    const failure = refused('sdk_error');
    const pay = walletWith({ kind: 'failed', failure });
    const onSparkFailure = vi.fn();
    const result = await payInvoiceSparkFirst(pay, { sparkInvoice: SPARK, pr: PR }, onSparkFailure);
    expect(result).toMatchObject({ kind: 'confirm', feeSats: 2, method: 'lightning' });
    expect(pay.mock.calls).toEqual([
      [{ type: 'input', input: SPARK }],
      [{ type: 'input', input: PR }],
    ]);
    expect(onSparkFailure).toHaveBeenCalledTimes(1);
    expect(onSparkFailure).toHaveBeenCalledWith(failure);
  });

  it('falls back without a callback, and returns the fallback failure as it is', async () => {
    const lightning: WalletPayResult = { kind: 'failed', failure: refused('no_route') };
    const pay = vi.fn(async (request: WalletPayRequest) =>
      request.type === 'input' && request.input === SPARK
        ? ({ kind: 'failed', failure: refused('sdk_error') } as WalletPayResult)
        : lightning,
    );
    expect(await payInvoiceSparkFirst(pay, { sparkInvoice: SPARK, pr: PR })).toBe(lightning);
    expect(pay).toHaveBeenCalledTimes(2);
  });

  it('keeps every other Spark failure, since Lightning would stop on the same cause', async () => {
    const reasons: PayReason[] = ['expired', 'timeout', 'network', 'disconnected', 'balance_read'];
    for (const reason of reasons) {
      const spark: WalletPayResult = { kind: 'failed', failure: refused(reason) };
      const pay = walletWith(spark);
      const onSparkFailure = vi.fn();
      expect(await payInvoiceSparkFirst(pay, { sparkInvoice: SPARK, pr: PR }, onSparkFailure)).toBe(
        spark,
      );
      expect(pay).toHaveBeenCalledTimes(1);
      expect(onSparkFailure).not.toHaveBeenCalled();
    }
  });

  it('keeps a balance too low, a refused minimum, and a locked wallet', async () => {
    const outcomes: WalletPayResult[] = [
      { kind: 'insufficient', feeSats: 0, failure: refused('insufficient') },
      { kind: 'belowMinimum', minSats: 100, failure: refused('below_minimum') },
      { kind: 'unlock', failure: refused('unlock') },
    ];
    for (const spark of outcomes) {
      const pay = walletWith(spark);
      expect(await payInvoiceSparkFirst(pay, { sparkInvoice: SPARK, pr: PR })).toBe(spark);
      expect(pay).toHaveBeenCalledTimes(1);
    }
  });
});
