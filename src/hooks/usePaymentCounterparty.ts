'use client';

import { useEffect, useRef, useState } from 'react';
import { useActiveSession } from '@/hooks/useActiveSession';
import { visualPin } from '@/lib/visual-pin';
import {
  fetchPaymentCounterparties,
  type PaymentCounterparty,
} from '@/lib/wallet/payment-counterparty';
import {
  RECEIVED_FROM_MEMBER_SENDER,
  SENT_TO_MEMBER_COUNTERPARTY,
} from '@/lib/wallet/payment-fixtures';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/**
 * Resolve the counterparty of a completed payment in the active session.
 *
 * @param payment - Payment displayed by the wallet.
 * @returns The counterparty, or null while unknown or unavailable.
 */
export function usePaymentCounterparty(payment: WalletPayment): PaymentCounterparty | null {
  const session = useActiveSession();
  const pin = visualPin();
  const pinned = pin === 'received-from-member' || pin === 'sent-to-member';
  const direction = payment.direction === 'received' ? 'in' : 'out';
  const invoice = payment.info.invoice || null;
  const paymentHash = payment.info.paymentHash || null;
  const eligible = payment.status === 'completed' && (invoice !== null || paymentHash !== null);
  const key = JSON.stringify([payment.id, direction, invoice, paymentHash]);
  const cache = useRef<{ session: string | null; values: Map<string, PaymentCounterparty | null> }>(
    {
      session: null,
      values: new Map(),
    },
  );
  const [state, setState] = useState<{
    session: string;
    key: string;
    sender: PaymentCounterparty | null;
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
    void fetchPaymentCounterparties(session, [
      { id: payment.id, direction, invoice, paymentHash },
    ]).then((rows) => {
      if (!active) return;
      const sender = rows.find((row) => row.id === payment.id) ?? null;
      cache.current.values.set(key, sender);
      setState({ session, key, sender });
    });
    return () => {
      active = false;
    };
  }, [session, pinned, eligible, key, payment.id, direction, invoice, paymentHash]);

  if (pin === 'received-from-member' && payment.id === RECEIVED_FROM_MEMBER_SENDER.id && eligible)
    return RECEIVED_FROM_MEMBER_SENDER;
  if (pin === 'sent-to-member' && payment.id === SENT_TO_MEMBER_COUNTERPARTY.id && eligible)
    return SENT_TO_MEMBER_COUNTERPARTY;
  if (session === null || !eligible || state?.session !== session || state.key !== key) return null;
  return state.sender;
}
