import type { MessageKey } from '@/lib/messages';
import { visualPin } from '@/lib/visual-pin';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/** The line that names a payment: a counterparty or description, else a message key. */
export type PaymentTitle = { text: string } | { key: MessageKey };

/**
 * What a payment is called in the list and on its screen: a gift on a post
 * (a zap), the paid
 * Lightning address, the invoice description, the on-chain direction, or just
 * Received / Sent.
 *
 * @param payment - The payment.
 * @returns Literal text, or a message key to translate.
 */
export function paymentTitle(payment: WalletPayment): PaymentTitle {
  if (payment.info.zap !== undefined) {
    return { key: 'wallet.payment.giftOnPost' };
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
 * The message that came with a payment: the payer's note, the zap message, or
 * the comment sent to a Lightning address.
 *
 * @param payment - The payment.
 * @returns The message, or `null` when there is none.
 */
export function paymentMessage(payment: WalletPayment): string | null {
  if (payment.senderComment !== null) {
    return payment.senderComment;
  }
  if (payment.info.zap !== undefined && payment.info.zap.content !== '') {
    return payment.info.zap.content;
  }
  return payment.info.lnurlComment ?? null;
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
