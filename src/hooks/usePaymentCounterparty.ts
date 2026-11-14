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
import { walletReportSettled } from '@/lib/wallet/wallet-report';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';

/**
 * Pause before each further lookup after a miss, in order. The api names the
 * other side only once its own read of the wallet saw the transfer, which runs
 * about once a minute, so a miss right after a payment is expected. Four
 * retries at 15 s, 30 s, 60 s, and 120 s cover 3 min 45 s after the first
 * miss with at most five lookups per opened screen, far below the api's 60
 * lookups per account and minute.
 */
const RETRY_DELAYS_MS: readonly number[] = [15_000, 30_000, 60_000, 120_000];

/**
 * Resolve the counterparty of a completed Spark payment in the active session.
 * The api names only a plain Spark transfer, so a Lightning, on-chain, or
 * token payment is not looked up and keeps the rows it had before. Wait for
 * a running report before each lookup without requesting one, because the api
 * names only a payment the caller has already reported as completed.
 * Cache matches while mounted; after a miss, ask again after 15 s, 30 s,
 * 60 s, and 120 s, then stop until the screen is opened again. A miss is
 * never cached.
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
  const pin = visualPin();
  const pinned =
    pin === 'received-from-member' ||
    pin === 'sent-to-member' ||
    pin === 'received-member-unknown' ||
    pin === 'sent-member-unknown';
  const direction = payment.direction === 'received' ? 'in' : 'out';
  const eligible = payment.status === 'completed' && payment.method === 'spark';
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
    if (pinned) return;
    if (cache.current.session !== session) cache.current = { session, values: new Map() };
    if (session === null || !eligible) return;
    const cached = cache.current.values.get(key);
    if (cached !== undefined) {
      setState({ session, key, counterparty: cached });
      return;
    }
    let active = true;
    let timer: number | undefined;
    const lookup = async (attempt: number): Promise<void> => {
      await walletReportSettled();
      if (!active) return;
      const rows = await fetchPaymentCounterparties(session, [{ id: payment.id, direction }]);
      if (!active) return;
      const counterparty = rows.find((row) => row.id === payment.id) ?? null;
      if (counterparty !== null) cache.current.values.set(key, counterparty);
      setState({ session, key, counterparty });
      const delay = RETRY_DELAYS_MS[attempt];
      if (counterparty !== null || delay === undefined) return;
      timer = window.setTimeout(() => {
        void lookup(attempt + 1);
      }, delay);
    };
    void lookup(0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [session, pinned, eligible, key, payment.id, direction]);

  if (pin === 'received-from-member' && payment.id === RECEIVED_FROM_MEMBER_SENDER.id && eligible)
    return RECEIVED_FROM_MEMBER_SENDER;
  if (pin === 'sent-to-member' && payment.id === SENT_TO_MEMBER_COUNTERPARTY.id && eligible)
    return SENT_TO_MEMBER_COUNTERPARTY;
  if (session === null || !eligible || state?.session !== session || state.key !== key) return null;
  return state.counterparty;
}
