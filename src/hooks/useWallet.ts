'use client';

import { useCallback, useRef, useState } from 'react';
import { getE2eNow } from '@/lib/config';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { canUnlockWallet, unlockWalletPhrase } from '@/lib/wallet/wallet-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import { connectWallet } from '@/lib/wallet/wallet-service';
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
}

function visualStatus(): WalletStatus | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  const visual = new URLSearchParams(window.location.search).get('visual');
  switch (visual) {
    case 'balance-locked':
      return 'locked';
    case 'balance-connecting':
      return 'connecting';
    case 'balance-ready':
    case 'history-empty':
    case 'history-rows':
    case 'history-error':
      return 'ready';
    case 'balance-error':
      return 'error';
    default:
      return visual?.startsWith('send-') === true ? 'ready' : null;
  }
}

/**
 * Selects the wallet balance state and exposes guarded unlock and retry actions.
 * Visual pins (`?visual=balance-…`, and `?visual=history-…` or `?visual=send-…`
 * as ready) are honoured only in a Playwright build
 * (`getE2eNow()` set) and leave unlock and retry inert while pinned.
 *
 * @returns Wallet balance state and stable actions for `/wallet`.
 */
export function useWallet(): UseWalletResult {
  const storeStatus = useWalletStore((state) => state.status);
  const storeBalanceSats = useWalletStore((state) => state.balanceSats);
  const account = useAuthStore((state) => state.account);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const unlockInFlight = useRef(false);
  const pinnedStatus = visualStatus();

  const unlock = useCallback((): void => {
    if (pinnedStatus !== null || unlockInFlight.current) {
      return;
    }
    unlockInFlight.current = true;
    setUnlockFailed(false);
    setUnlocking(true);
    void unlockWalletPhrase()
      .then((result) => {
        if (result === 'failed') {
          setUnlockFailed(true);
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
    };
  }
  if (storeStatus === 'disabled' || !canUnlockWallet(account)) {
    return { status: 'disabled', balanceSats: null, unlock, retry };
  }
  if (unlocking) {
    return { status: 'connecting', balanceSats: null, unlock, retry };
  }
  if (storeStatus === 'locked' && unlockFailed) {
    return { status: 'error', balanceSats: null, unlock, retry };
  }
  return { status: storeStatus, balanceSats: storeBalanceSats, unlock, retry };
}
