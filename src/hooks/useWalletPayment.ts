'use client';

import { useEffect, useState } from 'react';
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
 * that fails keeps a payment already shown. Under the `?visual=history-rows`
 * pin (Playwright builds only) it shows the fixture payment with that id.
 *
 * @param id - SDK payment id, or `null` when the address has none.
 * @returns The payment state.
 */
export function useWalletPayment(id: string | null): WalletPaymentState {
  const ready = useWalletStore((state) => state.status === 'ready');
  const syncCount = useWalletStore((state) => state.syncCount);
  const [pinned] = useState(() => pinnedPayment(id));
  const [state, setState] = useState<WalletPaymentState>({ status: 'loading' });

  useEffect(() => {
    if (pinned !== null) {
      return;
    }
    if (id === null) {
      setState({ status: 'missing' });
      return;
    }
    if (!ready) {
      return;
    }
    let live = true;
    getWalletPayment(id).then(
      (payment) => {
        if (live) {
          setState({ status: 'ready', payment });
        }
      },
      () => {
        if (live) {
          setState((current) => (current.status === 'ready' ? current : { status: 'missing' }));
        }
      },
    );
    return () => {
      live = false;
    };
  }, [pinned, id, ready, syncCount]);

  return pinned ?? state;
}
