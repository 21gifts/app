'use client';

import { useCallback, useState } from 'react';
import { getE2eNow } from '@/lib/config';
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

/** State and action of the inline wallet setup note on money screens. */
export interface UseWalletSetupResult {
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
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return false;
  }
  if (getE2eNow() === null) {
    return false;
  }
  return SETUP_FAILED_PINS.has(new URLSearchParams(window.location.search).get('visual') ?? '');
}

/**
 * Whether the background wallet setup gave up for the current session while
 * the account still needs it, and the **Try again** of the inline setup note.
 * The setup itself runs in the background (`listenForWalletSetup`); there is
 * no dialog. A pinned note leaves the action inert.
 *
 * @returns Whether the note shows, and its retry action.
 */
export function useWalletSetup(): UseWalletSetupResult {
  const [pinned] = useState(walletSetupPin);
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

  return { failed: pinned || (due && failedSession !== null && failedSession === session), retry };
}
