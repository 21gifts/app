'use client';

import { useCallback } from 'react';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** Balance used by the deterministic `/wallet` visual fixture (Playwright builds only). */
export const WALLET_VISUAL_FIXTURE_SATS = 21_000;

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
   * False while the one-time wallet setup is due or gave up: the account's
   * address is not registered yet, so **Receive** stays disabled.
   */
  canReceive: boolean;
}

/**
 * Status pinned by `?visual=`, honoured only in a Playwright build.
 *
 * @returns The pinned status, or `null` for the live wallet.
 */
function visualStatus(): WalletViewStatus | null {
  const visual = visualPin();
  switch (visual) {
    case 'balance-connecting':
    case 'send-alert-not-ready':
      return 'connecting';
    case 'balance-ready':
    case 'history-empty':
    case 'history-rows':
    case 'history-error':
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
 * `setupFailed` once the setup gave up, and **Receive** stays disabled
 * (`canReceive`). Visual pins (`?visual=balance-…`, `?visual=history-…`,
 * `?visual=send-alert-not-ready` as connecting, and the other
 * `?visual=send-…` pins as ready) are honoured only in a Playwright build
 * (`getE2eNow()` set) and leave retry inert while pinned.
 *
 * @returns Wallet balance state and a stable retry for `/wallet`.
 */
export function useWallet(): UseWalletResult {
  const storeStatus = useWalletStore((state) => state.status);
  const storeBalanceSats = useWalletStore((state) => state.balanceSats);
  const account = useAuthStore((state) => state.account);
  const pinnedStatus = visualStatus();
  const setup = useWalletSetup();

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
      canReceive: !setup.failed,
    };
  }
  const base = { balanceSats: null, retry, setupFailed: false, canReceive: true };
  if (storeStatus === 'disabled' || !canUnlockWallet(account)) {
    return { ...base, status: 'disabled' };
  }
  if (needsWalletSetup(account)) {
    return setup.failed
      ? { ...base, status: 'error', setupFailed: true, canReceive: false }
      : { ...base, status: 'connecting', canReceive: false };
  }
  return {
    ...base,
    status: storeStatus === 'locked' ? 'connecting' : storeStatus,
    balanceSats: storeBalanceSats,
  };
}
