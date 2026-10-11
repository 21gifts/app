'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { visualPin } from '@/lib/visual-pin';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { onIncomingPayment } from '@/lib/wallet/wallet-service';

/** Screenshot pin that shows a payment that just arrived (Playwright builds only). */
const RECEIVED_VISUAL_PIN = 'wallet-received';

/** The payment the `?visual=wallet-received` pin shows: ₿500 from a 21.gifts address. */
const RECEIVED_VISUAL_FIXTURE: WalletPayment = {
  id: 'b1c4a3a2-5e0f-4f3e-9d43-2a6f0c7d9e15',
  direction: 'received',
  amountSats: 500,
  feesSats: 0,
  timestamp: 1767783600000,
  status: 'completed',
  method: 'lightning',
  senderComment: null,
  info: { lnAddress: 'bruno@21.gifts' },
};

/** State returned by {@link useIncomingPayment}. */
export interface IncomingPaymentState {
  /** The payment that arrived last, while it is still shown; otherwise `null`. */
  payment: WalletPayment | null;
  /** Stops showing the payment before its time is up. */
  dismiss: () => void;
}

/**
 * The received payment that completed last while the app is open, for
 * `holdMs` after it arrived. A newer payment replaces it and starts the time
 * again. Under the `?visual=wallet-received` pin (honoured only in a
 * Playwright build) a fixed ₿500 payment is shown until dismissed, without a
 * timer.
 *
 * @param holdMs - How long a payment stays shown, in milliseconds.
 * @returns The payment to show and a dismiss action.
 */
export function useIncomingPayment(holdMs: number): IncomingPaymentState {
  const [payment, setPayment] = useState<WalletPayment | null>(null);
  // Read when a payment arrives, so a new hold time never drops the running timer.
  const holdRef = useRef(holdMs);
  useLayoutEffect(() => {
    holdRef.current = holdMs;
  });

  useEffect(() => {
    // Read after the commit: during a client navigation the address is the new one only by then.
    if (visualPin() === RECEIVED_VISUAL_PIN) {
      setPayment(RECEIVED_VISUAL_FIXTURE);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onIncomingPayment((next) => {
      clearTimeout(timer);
      setPayment(next);
      timer = setTimeout(() => {
        setPayment(null);
      }, holdRef.current);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((): void => {
    setPayment(null);
  }, []);

  return { payment, dismiss };
}
