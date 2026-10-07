'use client';

import { useCallback, useRef, useState } from 'react';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { visualPin } from '@/lib/visual-pin';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
import { needsWalletSetup } from '@/lib/wallet/wallet-setup';
import { useAuthStore } from '@/stores/auth-store';
import { useWalletStore, type WalletStatus } from '@/stores/wallet-store';

/** Balance used by the deterministic `/wallet` visual fixture (Playwright builds only). */
export const WALLET_VISUAL_FIXTURE_SATS = 21_000;

/** State and actions exposed to the wallet balance entry surface. */
export interface UseWalletResult {
  /** Wallet state the screen should render. */
  status: WalletStatus;
  /** Current whole-sat balance, or `null` before it is available. */
  balanceSats: number | null;
  /** Opens the wallet phrase with the member's passkey. */
  unlock: () => void;
  /** Repeats phrase opening or connection after an error. */
  retry: () => void;
  /**
   * True while `status` is `error` because the passkey gave no PRF output, so
   * this phone or browser cannot hold the wallet.
   */
  prfUnsupported: boolean;
  /**
   * True while `status` is `error` because the background wallet setup gave
   * up; the balance shows the inline setup note instead of the open error.
   */
  setupFailed: boolean;
}

function visualStatus(): WalletStatus | null {
  const visual = visualPin();
  switch (visual) {
    case 'balance-locked':
    case 'send-alert-locked':
      return 'locked';
    case 'balance-connecting':
      return 'connecting';
    case 'balance-ready':
    case 'history-empty':
    case 'history-rows':
    case 'history-error':
      return 'ready';
    case 'balance-error':
    case 'balance-prf-unsupported':
    case 'balance-setup-failed':
      return 'error';
    default:
      return visual?.startsWith('send-') === true ? 'ready' : null;
  }
}

/**
 * Selects the wallet balance state and exposes guarded unlock and retry actions.
 * An unlock whose passkey gives no PRF output shows `error` with
 * `prfUnsupported`. For an account whose one-time wallet setup is still due,
 * **Unlock wallet** is the passkey prompt the setup needs: once the phrase is
 * in tab memory the setup runs in the background and the balance shows
 * `connecting` until the wallet is verified, or `error` with `setupFailed`
 * once the setup gave up. Visual pins (`?visual=balance-…`, `?visual=send-alert-locked` as locked, and
 * `?visual=history-…` and the other `?visual=send-…` pins as ready) are
 * honoured only in a Playwright build (`getE2eNow()` set) and leave unlock and
 * retry inert while pinned.
 *
 * @returns Wallet balance state and stable actions for `/wallet`.
 */
export function useWallet(): UseWalletResult {
  const storeStatus = useWalletStore((state) => state.status);
  const storeBalanceSats = useWalletStore((state) => state.balanceSats);
  const account = useAuthStore((state) => state.account);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailure, setUnlockFailure] = useState<'failed' | 'noPrf' | null>(null);
  const unlockInFlight = useRef(false);
  const pinnedStatus = visualStatus();
  const pinnedPrf = pinnedStatus === 'error' && visualPin() === 'balance-prf-unsupported';
  const setup = useWalletSetup();

  const unlock = useCallback((): void => {
    if (pinnedStatus !== null || unlockInFlight.current) {
      return;
    }
    unlockInFlight.current = true;
    setUnlockFailure(null);
    setUnlocking(true);
    void unlockWalletPhrase()
      .then((result) => {
        if (result === 'failed' || result === 'noPrf') {
          setUnlockFailure(result);
        }
      })
      .finally(() => {
        unlockInFlight.current = false;
        setUnlocking(false);
      });
  }, [pinnedStatus]);

  const retry = useCallback((): void => {
    if (pinnedStatus !== null) {
      return;
    }
    if (peekSessionPhrase() === null) {
      unlock();
      return;
    }
    if (walletNeedsReload()) {
      window.location.reload();
      return;
    }
    void connectWallet();
  }, [pinnedStatus, unlock]);

  if (pinnedStatus !== null) {
    return {
      status: pinnedStatus,
      balanceSats: pinnedStatus === 'ready' ? WALLET_VISUAL_FIXTURE_SATS : null,
      unlock,
      retry,
      prfUnsupported: pinnedPrf,
      setupFailed: pinnedStatus === 'error' && setup.failed,
    };
  }
  const idle = { balanceSats: null, unlock, retry, prfUnsupported: false, setupFailed: false };
  if (storeStatus === 'disabled' || !canUnlockWallet(account)) {
    return { ...idle, status: 'disabled' };
  }
  if (unlocking) {
    return { ...idle, status: 'connecting' };
  }
  if (storeStatus === 'locked' && unlockFailure !== null) {
    return { ...idle, status: 'error', prfUnsupported: unlockFailure === 'noPrf' };
  }
  if (storeStatus !== 'locked' && needsWalletSetup(account)) {
    return setup.failed
      ? { ...idle, status: 'error', setupFailed: true }
      : { ...idle, status: 'connecting' };
  }
  return { ...idle, status: storeStatus, balanceSats: storeBalanceSats };
}
