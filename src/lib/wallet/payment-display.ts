import type { MessageKey } from '@/lib/messages';
import { visualPin } from '@/lib/visual-pin';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/** The line that names a payment: a counterparty or description, else a message key. */
export type PaymentTitle = { text: string } | { key: MessageKey };

/**
 * What a payment is called in the list and on its screen: a gift on a post
 * (a zap), a gift, a shop payment, the paid Lightning address, the invoice
 * description, the on-chain direction, or just Received / Sent.
 *
 * @param payment - The payment.
 * @returns Literal text, or a message key to translate.
 */
export function paymentTitle(payment: WalletPayment): PaymentTitle {
  if (payment.info.zap !== undefined) {
    return { key: 'wallet.payment.giftOnPost' };
  }
  if (payment.info.purpose === 'gift' && payment.direction === 'received') {
    return { key: 'wallet.payment.giftOnPost' };
  }
  if (payment.info.purpose === 'gift' && payment.direction === 'sent') {
    return { key: 'wallet.payment.gift' };
  }
  if (payment.info.purpose === 'shop') {
    return { key: 'wallet.payment.shop' };
  }
  if (payment.info.lnAddress !== undefined) {
    return { text: payment.info.lnAddress };
  }
  if (payment.info.description !== undefined) {
    return { text: payment.info.description };
  }
  if (payment.method === 'deposit') {
    return { key: 'wallet.payment.method.deposit' };
  }
  if (payment.method === 'withdraw') {
    return { key: 'wallet.payment.method.withdraw' };
  }
  return { key: payment.direction === 'received' ? 'wallet.received' : 'wallet.sent' };
}

/**
 * Zap content of a loan repayment paid over Lightning: `repay:<day>:<uuid>` with
 * a canonical 8-4-4-4-12 hex UUID, the shape the api writes. A marker, not a message.
 */
const REPAYMENT_MARKER =
  /^repay:\d+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The message that came with a payment: the payer's note, the zap message, or
 * the comment sent to a Lightning address. A loan repayment's zap marker
 * (`repay:<day>:<uuid>`) is not a message.
 *
 * @param payment - The payment.
 * @returns The message, or `null` when there is none.
 */
export function paymentMessage(payment: WalletPayment): string | null {
  if (payment.senderComment !== null) {
    return payment.senderComment;
  }
  if (payment.info.zap !== undefined && payment.info.zap.content !== '') {
    return REPAYMENT_MARKER.test(payment.info.zap.content) ? null : payment.info.zap.content;
  }
  return payment.info.lnurlComment ?? null;
}

/**
 * The hash the wallet hearts lookup is asked about for a payment: its payment
 * hash, lowercased, once the payment is no longer pending and when it is not a
 * shop payment. A gift memo and a loan repayment over the Lightning fallback
 * (no memo, so no purpose) both qualify.
 *
 * @param payment - The payment.
 * @returns The lowercase hash to look up, or `null` when the payment is not looked up.
 */
export function paymentLookupHash(payment: WalletPayment): string | null {
  if (
    payment.status === 'pending' ||
    payment.info.purpose === 'shop' ||
    typeof payment.info.paymentHash !== 'string'
  ) {
    return null;
  }
  return payment.info.paymentHash.toLowerCase();
}

/**
 * The address of a payment's screen. Under the `?visual=history-rows` pin
 * (Playwright builds only) the pin goes along, so the screen shows the same
 * fixture payment.
 *
 * @param id - SDK payment id.
 * @returns The `/wallet/payment` path for it.
 */
export function paymentHref(id: string): string {
  const path = `/wallet/payment?id=${encodeURIComponent(id)}`;
  return visualPin() === 'history-rows' ? `${path}&visual=history-rows` : path;
}
