'use client';

import { useCallback, useState } from 'react';
import { visualPin } from '@/lib/visual-pin';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { needsWalletSetup, retryWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore } from '@/stores/wallet-store';

/** Screenshot pins that show the setup note on a money screen. */
const SETUP_FAILED_PINS = new Set([
  'balance-setup-failed',
  'wallet-pay-setup-failed',
  'pos-setup-failed',
]);

/** Screenshot pin that shows a money screen while the background setup is still due. */
const SETUP_PENDING_PIN = 'setup-pending';

/** State and action of the inline wallet setup note on money screens. */
export interface UseWalletSetupResult {
  /** True while the account still needs the one-time setup (`needsWalletSetup`). */
  due: boolean;
  /** True when the background setup gave up for this session and is still due. */
  failed: boolean;
  /** Starts the setup again; reloads when the wallet must reload. */
  retry: () => void;
}

/**
 * Screenshot pin for the setup note (`?visual=balance-setup-failed`,
 * `?visual=wallet-pay-setup-failed`, or `?visual=pos-setup-failed`), honoured
 * only in a Playwright build (`getE2eNow()` set).
 *
 * @returns Whether a setup-note pin is set.
 */
export function walletSetupPin(): boolean {
  return SETUP_FAILED_PINS.has(visualPin() ?? '');
}

/**
 * Whether the one-time wallet setup is still due, whether the background
 * setup gave up for the current session while the account still needs it,
 * and the **Try again** of the inline setup note. The setup itself runs in the
 * background (`listenForWalletSetup`); there is no dialog. In a Playwright
 * build only, `?visual=setup-pending` pins `due` and a setup-note pin pins
 * `failed`; a pinned note leaves the action inert.
 *
 * @returns Whether the setup is due, whether the note shows, and its retry action.
 */
export function useWalletSetup(): UseWalletSetupResult {
  const [pinned] = useState(walletSetupPin);
  const [pendingPinned] = useState(() => visualPin() === SETUP_PENDING_PIN);
  const failedSession = useWalletStore((state) => state.setupFailedSession);
  const session = useAuthStore((state) => state.session);
  const due = useAuthStore((state) => needsWalletSetup(state.account));

  const retry = useCallback((): void => {
    if (pinned) {
      return;
    }
    if (walletNeedsReload()) {
      window.location.reload();
      return;
    }
    void retryWalletSetup();
  }, [pinned]);

  return {
    due: pendingPinned || due,
    failed: pinned || (due && failedSession !== null && failedSession === session),
    retry,
  };
}
