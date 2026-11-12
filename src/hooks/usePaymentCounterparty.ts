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
import { reportWallet } from '@/lib/wallet/wallet-report';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { useWalletStore } from '@/stores/wallet-store';

/**
 * Resolve the counterparty of a completed payment in the active session.
 * Cache matches; after a wallet sync, wait for its report and retry a miss.
 * In a Playwright build, `?visual=received-from-member` and
 * `?visual=sent-to-member` return their fixtures without a request, and
 * `?visual=received-member-unknown` and `?visual=sent-member-unknown` return
 * null without a request.
 *
 * @param payment - Payment displayed by the wallet.
 * @returns The counterparty, or null while unknown or unavailable.
 */
export function usePaymentCounterparty(payment: WalletPayment): PaymentCounterparty | null {
  const session = useActiveSession();
  const syncCount = useWalletStore((state) => state.syncCount);
  const previousSyncCount = useRef(syncCount);
  const pin = visualPin();
  const pinned =
    pin === 'received-from-member' ||
    pin === 'sent-to-member' ||
    pin === 'received-member-unknown' ||
    pin === 'sent-member-unknown';
  const direction = payment.direction === 'received' ? 'in' : 'out';
  const eligible = payment.status === 'completed';
  const key = JSON.stringify([payment.id, direction]);
  const cache = useRef<{ session: string | null; values: Map<string, PaymentCounterparty> }>({
    session: null,
    values: new Map(),
  });
  const [state, setState] = useState<{
    session: string;
    key: string;
    counterparty: PaymentCounterparty | null;
  } | null>(null);

  useEffect(() => {
    const synced = previousSyncCount.current !== syncCount;
    if (pinned) return;
    if (cache.current.session !== session) cache.current = { session, values: new Map() };
    if (session === null || !eligible) return;
    const cached = cache.current.values.get(key);
    if (cached !== undefined) {
      setState({ session, key, counterparty: cached });
      return;
    }
    let active = true;
    const lookup = async (): Promise<void> => {
      if (synced) {
        await reportWallet();
        if (!active) return;
      }
      previousSyncCount.current = syncCount;
      const rows = await fetchPaymentCounterparties(session, [{ id: payment.id, direction }]);
      if (!active) return;
      const counterparty = rows.find((row) => row.id === payment.id) ?? null;
      if (counterparty !== null) cache.current.values.set(key, counterparty);
      setState({ session, key, counterparty });
    };
    void lookup();
    return () => {
      active = false;
    };
  }, [session, pinned, eligible, key, payment.id, direction, syncCount]);

  if (pin === 'received-from-member' && payment.id === RECEIVED_FROM_MEMBER_SENDER.id && eligible)
    return RECEIVED_FROM_MEMBER_SENDER;
  if (pin === 'sent-to-member' && payment.id === SENT_TO_MEMBER_COUNTERPARTY.id && eligible)
    return SENT_TO_MEMBER_COUNTERPARTY;
  if (session === null || !eligible || state?.session !== session || state.key !== key) return null;
  return state.counterparty;
}
