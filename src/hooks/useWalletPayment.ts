'use client';

import { useEffect, useMemo, useState } from 'react';
import { visualPin } from '@/lib/visual-pin';
import { WALLET_PAYMENT_FIXTURES } from '@/lib/wallet/payment-fixtures';
import { toWalletPayment, type WalletPayment } from '@/lib/wallet/wallet-sdk';
import { getWalletPayment } from '@/lib/wallet/wallet-service';
import { useWalletStore } from '@/stores/wallet-store';

/** Load state of one payment. */
export type WalletPaymentState =
  { status: 'loading' } | { status: 'ready'; payment: WalletPayment } | { status: 'missing' };

/**
 * The fixture payment under the `?visual=history-rows` pin (Playwright builds only).
 *
 * @param id - Payment id from the address.
 * @returns The pinned state, or `null` without the pin.
 */
function pinnedPayment(id: string | null): WalletPaymentState | null {
  if (visualPin() !== 'history-rows') {
    return null;
  }
  const payment = WALLET_PAYMENT_FIXTURES.find((entry) => entry.id === id);
  return payment === undefined
    ? { status: 'missing' }
    : { status: 'ready', payment: toWalletPayment(payment) };
}

/**
 * Loads one payment of the connected wallet by id once the wallet is ready,
 * and again after each wallet sync, so a pending payment updates in place. A
 * missing id or a payment the wallet does not know is `missing`; a later read
 * of the same id that fails keeps the payment already shown, and a wallet that
 * stops being ready drops it back to `loading`. The state belongs
 * to one id: another id starts at `loading` and never shows the previous
 * payment. Under the `?visual=history-rows` pin (Playwright builds only) it
 * shows the fixture payment with that id.
 *
 * @param id - SDK payment id, or `null` when the address has none.
 * @returns The payment state.
 */
export function useWalletPayment(id: string | null): WalletPaymentState {
  const ready = useWalletStore((state) => state.status === 'ready');
  const syncCount = useWalletStore((state) => state.syncCount);
  const pinned = useMemo(() => pinnedPayment(id), [id]);
  const [loaded, setLoaded] = useState<{ id: string | null; state: WalletPaymentState }>({
    id,
    state: { status: 'loading' },
  });

  useEffect(() => {
    if (pinned !== null) {
      return;
    }
    if (id === null) {
      setLoaded({ id, state: { status: 'missing' } });
      return;
    }
    if (!ready) {
      // A payment read while the wallet was open is not shown once it locks or fails.
      setLoaded({ id, state: { status: 'loading' } });
      return;
    }
    let live = true;
    getWalletPayment(id).then(
      (payment) => {
        if (live) {
          setLoaded({ id, state: { status: 'ready', payment } });
        }
      },
      () => {
        if (live) {
          setLoaded((current) =>
            current.id === id && current.state.status === 'ready'
              ? current
              : { id, state: { status: 'missing' } },
          );
        }
      },
    );
    return () => {
      live = false;
    };
  }, [pinned, id, ready, syncCount]);

  if (pinned !== null) {
    return pinned;
  }
  return loaded.id === id ? loaded.state : { status: 'loading' };
}
