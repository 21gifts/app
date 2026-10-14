'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** Balance used by the deterministic `/wallet` visual fixture (Playwright builds only). */
export const WALLET_VISUAL_FIXTURE_SATS = 21_000;

/** Screenshot pin that shows a failed open which the wallet recovers from by itself. */
const REOPENING_PIN = 'balance-reopening';

/**
 * How long the `?visual=balance-reopening` pin shows the failed open before
 * it shows the ready wallet, in milliseconds (Playwright builds only).
 */
export const WALLET_VISUAL_REOPEN_MS = 4_000;

/**
 * Wallet state a signed-in screen renders. There is no locked state: signed
 * in means the wallet is open in this tab, so a store that has not started
 * connecting yet shows as `connecting`.
 */
export type WalletViewStatus = Exclude<WalletStatus, 'locked'>;

/** State and actions exposed to the wallet balance entry surface. */
export interface UseWalletResult {
  /** Wallet state the screen should render. */
  status: WalletViewStatus;
  /** Current whole-sat balance, or `null` before it is available. */
  balanceSats: number | null;
  /** Connects again after an error (reloads the page when the wallet must reload). */
  retry: () => void;
  /**
   * True while `status` is `error` because the background wallet setup gave
   * up; the balance shows the inline setup note instead of the open error.
   */
  setupFailed: boolean;
  /**
   * True while `status` is `error` after a failed open and the wallet is
   * opened again automatically in the background; the status turns `ready`
   * on its own once a retry succeeds.
   */
  retrying: boolean;
}

/**
 * Status pinned by `?visual=`, honoured only in a Playwright build.
 *
 * @param reopened - Whether the `balance-reopening` pin has reached its ready half.
 * @returns The pinned status, or `null` for the live wallet.
 */
function visualStatus(reopened: boolean): WalletViewStatus | null {
  const visual = visualPin();
  switch (visual) {
    case REOPENING_PIN:
      return reopened ? 'ready' : 'error';
    case 'balance-connecting':
    case 'setup-pending':
      return 'connecting';
    case 'balance-ready':
    case 'history-empty':
    case 'history-rows':
    case 'history-error':
    case 'wallet-received':
    case 'move-arrived':
      return 'ready';
    case 'balance-error':
    case 'balance-setup-failed':
      return 'error';
    default:
      return visual?.startsWith('send-') === true ? 'ready' : null;
  }
}

/**
 * Selects the wallet balance state and a guarded retry. A signed-in member's
 * wallet is open in this tab (`OnboardingGate` shows the login otherwise), so
 * there is no unlock here: a store that has not connected yet shows
 * `connecting`. While the one-time wallet setup is still due the balance
 * shows `connecting` until the wallet is verified, or `error` with
 * `setupFailed` once the setup gave up. After a failed open the status is
 * `error` with `retrying` set while the wallet service opens the wallet again
 * in the background, and turns `ready` on its own. Visual pins (`?visual=balance-…`,
 * `?visual=history-…`, `?visual=wallet-received` and `?visual=move-arrived` as ready, `?visual=setup-pending` as connecting, and the
 * `?visual=send-…` pins as ready, and `?visual=balance-reopening` as a failed open with `retrying`
 * that turns ready after {@link WALLET_VISUAL_REOPEN_MS}) are honoured only in a Playwright build
 * (`getE2eNow()` set) and leave retry inert while pinned.
 *
 * @returns Wallet balance state and a stable retry for `/wallet`.
 */
export function useWallet(): UseWalletResult {
  const storeStatus = useWalletStore((state) => state.status);
  const storeBalanceSats = useWalletStore((state) => state.balanceSats);
  const storeRetrying = useWalletStore((state) => state.retrying);
  const account = useAuthStore((state) => state.account);
  const [reopened, setReopened] = useState(false);
  const pinnedStatus = visualStatus(reopened);
  const setup = useWalletSetup();

  useEffect(() => {
    if (visualPin() !== REOPENING_PIN) {
      return;
    }
    const timer = setTimeout(() => {
      setReopened(true);
    }, WALLET_VISUAL_REOPEN_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const retry = useCallback((): void => {
    if (pinnedStatus !== null) {
      return;
    }
    if (walletNeedsReload()) {
      window.location.reload();
      return;
    }
    void connectWallet();
  }, [pinnedStatus]);

  if (pinnedStatus !== null) {
    return {
      status: pinnedStatus,
      balanceSats: pinnedStatus === 'ready' ? WALLET_VISUAL_FIXTURE_SATS : null,
      retry,
      setupFailed: pinnedStatus === 'error' && setup.failed,
      retrying: pinnedStatus === 'error' && visualPin() === REOPENING_PIN,
    };
  }
  const base = { balanceSats: null, retry, setupFailed: false, retrying: false };
  if (storeStatus === 'disabled' || !canUnlockWallet(account)) {
    return { ...base, status: 'disabled' };
  }
  if (setup.due) {
    return setup.failed
      ? { ...base, status: 'error', setupFailed: true }
      : { ...base, status: 'connecting' };
  }
  return {
    ...base,
    status: storeStatus === 'locked' ? 'connecting' : storeStatus,
    balanceSats: storeBalanceSats,
    retrying: storeStatus === 'error' && storeRetrying,
  };
}
