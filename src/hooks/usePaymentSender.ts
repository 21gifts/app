'use client';

import { useEffect, useRef, useState } from 'react';
import { useActiveSession } from '@/hooks/useActiveSession';
import { visualPin } from '@/lib/visual-pin';
import { fetchPaymentSenders, type PaymentSender } from '@/lib/wallet/payment-sender';
import { RECEIVED_FROM_MEMBER_SENDER } from '@/lib/wallet/payment-fixtures';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/**
 * Resolve the sender of a completed incoming payment in the active session.
 *
 * @param payment - Payment displayed by the wallet.
 * @returns The sender, or null while unknown or unavailable.
 */
export function usePaymentSender(payment: WalletPayment): PaymentSender | null {
  const session = useActiveSession();
  const pinned = visualPin() === 'received-from-member';
  const invoice = payment.info.invoice || null;
  const paymentHash = payment.info.paymentHash || null;
  const eligible =
    payment.direction === 'received' &&
    payment.status === 'completed' &&
    (invoice !== null || paymentHash !== null);
  const key = JSON.stringify([payment.id, invoice, paymentHash]);
  const cache = useRef<{ session: string | null; values: Map<string, PaymentSender | null> }>({
    session: null,
    values: new Map(),
  });
  const [state, setState] = useState<{
    session: string;
    key: string;
    sender: PaymentSender | null;
  } | null>(null);

  useEffect(() => {
    if (pinned) return;
    if (cache.current.session !== session) cache.current = { session, values: new Map() };
    if (session === null || !eligible) return;
    const cached = cache.current.values.get(key);
    if (cached !== undefined) {
      setState({ session, key, sender: cached });
      return;
    }
    let active = true;
    void fetchPaymentSenders(session, [{ id: payment.id, invoice, paymentHash }]).then((rows) => {
      if (!active) return;
      const sender = rows.find((row) => row.id === payment.id) ?? null;
      cache.current.values.set(key, sender);
      setState({ session, key, sender });
    });
    return () => {
      active = false;
    };
  }, [session, pinned, eligible, key, payment.id, invoice, paymentHash]);

  if (pinned && payment.id === RECEIVED_FROM_MEMBER_SENDER.id && eligible)
    return RECEIVED_FROM_MEMBER_SENDER;
  if (session === null || !eligible || state?.session !== session || state.key !== key) return null;
  return state.sender;
}
