'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { visualPin } from '@/lib/visual-pin';
import { useAuthStore } from '@/stores/auth-store';
import type { WalletPayment } from '@/lib/wallet/wallet-sdk';
import { onIncomingPayment } from '@/lib/wallet/wallet-service';

/** Screenshot pin that shows a payment that just arrived (Playwright builds only). */
const RECEIVED_VISUAL_PIN = 'wallet-received';

/** The payment the `?visual=wallet-received` pin shows: ₿500 received. */
const RECEIVED_VISUAL_FIXTURE: WalletPayment = {
  id: 'b1c4a3a2-5e0f-4f3e-9d43-2a6f0c7d9e15',
  direction: 'received',
  amountSats: 500,
  feesSats: 0,
  timestamp: 1767783600000,
  status: 'completed',
  method: 'lightning',
  senderComment: null,
  info: {},
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
 * Playwright build) a fixed ₿500 payment arrives on mount and is held for
 * `holdMs` like a real one, so the screenshots reach each later state with
 * Playwright's clock. A payment belongs to the session it arrived in: it is never shown
 * after that session ended or under another one, and nothing is listened for
 * while signed out.
 *
 * @param holdMs - How long a payment stays shown, in milliseconds.
 * @returns The payment to show and a dismiss action.
 */
export function useIncomingPayment(holdMs: number): IncomingPaymentState {
  const session = useAuthStore((state) => state.session);
  const [shown, setShown] = useState<{ session: string; payment: WalletPayment } | null>(null);
  // Read when a payment arrives, so a new hold time never drops the running timer.
  const holdRef = useRef(holdMs);
  useLayoutEffect(() => {
    holdRef.current = holdMs;
  });

  useEffect(() => {
    setShown(null);
    if (session === null) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (next: WalletPayment): void => {
      clearTimeout(timer);
      setShown({ session, payment: next });
      timer = setTimeout(() => {
        setShown(null);
      }, holdRef.current);
    };
    // Read after the commit: during a client navigation the address is the new one only by then.
    if (visualPin() === RECEIVED_VISUAL_PIN) {
      show(RECEIVED_VISUAL_FIXTURE);
      return () => {
        clearTimeout(timer);
      };
    }
    const unsubscribe = onIncomingPayment(show);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [session]);

  const dismiss = useCallback((): void => {
    setShown(null);
  }, []);

  // Also for the render between a session change and the effect that clears it.
  const payment = shown !== null && shown.session === session ? shown.payment : null;
  return { payment, dismiss };
}
