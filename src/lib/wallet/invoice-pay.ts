import type { PaymentFailure } from '@/lib/wallet/payment-failure';
import type { WalletPayResult } from '@/lib/wallet/wallet-service';
import type { WalletPayRequest } from '@/lib/wallet/wallet-sdk';

/**
 * One invoice the api issued for an in-app payment: the fee-free Spark
 * invoice to the receiving member's wallet when the api issued one, and the
 * Lightning payment request of the same invoice.
 */
export interface SparkFirstInvoice {
  /** Spark invoice to pay first, or `null`/`undefined`/`''` when the api issued none. */
  sparkInvoice: string | null | undefined;
  /** Lightning payment request of the same invoice. */
  pr: string;
}

/**
 * Prepares one api invoice in the in-app wallet, Spark first. With a Spark
 * invoice the wallet prepares that Spark transfer, which carries no fee. When
 * the wallet refuses the Spark invoice itself (`failed` with reason
 * `sdk_error`), `onSparkFailure` gets that failure and the Lightning payment
 * request `pr` is prepared instead. Every other outcome of the Spark prepare is
 * returned as it is: a confirmation, a balance too low (Lightning costs more),
 * no connection, an expired invoice, a timeout, a network error, a changed
 * connection, or a failed balance read, because Lightning would stop on the
 * same cause. Without a Spark invoice it prepares `pr` at once. It only
 * prepares: the fallback is chosen before this call sends anything.
 *
 * @param pay - The wallet prepare (`payFromWallet`, or an injected one).
 * @param invoice - Spark invoice and payment request of the same invoice.
 * @param onSparkFailure - Called with the Spark prepare's failure before the fallback.
 * @returns The prepare result of the Spark invoice, or of `pr` after a fallback or without one.
 */
export async function payInvoiceSparkFirst(
  pay: (request: WalletPayRequest) => Promise<WalletPayResult>,
  invoice: SparkFirstInvoice,
  onSparkFailure?: (failure: PaymentFailure) => void,
): Promise<WalletPayResult> {
  const spark = invoice.sparkInvoice;
  if (typeof spark !== 'string' || spark === '') {
    return pay({ type: 'input', input: invoice.pr });
  }
  const first = await pay({ type: 'input', input: spark });
  if (first.kind !== 'failed' || first.failure.reason !== 'sdk_error') {
    return first;
  }
  onSparkFailure?.(first.failure);
  return pay({ type: 'input', input: invoice.pr });
}
