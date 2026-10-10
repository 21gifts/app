'use client';

import { useEffect } from 'react';
import { reportWallet } from '@/lib/wallet/wallet-report';
import { listenForWalletPhrase, refreshWallet } from '@/lib/wallet/wallet-service';
import { listenForWalletSetup } from '@/lib/wallet/wallet-setup';
import { useWalletStore } from '@/stores/wallet-store';

/** How often an open wallet reads its synced balance while the app is open. */
export const WALLET_REPORT_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps the wallet connection synchronized with the tab-memory phrase, and
 * runs the one-time wallet setup in the background once the phrase is there
 * and the account needs it. The phrase listener is added first, so it opens
 * the connection the setup then reuses. While signed in, it sends the wallet
 * data report after every successful wallet read (login, each sync, after a
 * payment) and reads the synced balance every
 * {@link WALLET_REPORT_INTERVAL_MS}.
 *
 * @returns `null` because the root listener has no visual surface.
 */
export function WalletSync(): null {
  useEffect(() => {
    const stopPhrase = listenForWalletPhrase();
    const stopSetup = listenForWalletSetup();
    return () => {
      stopSetup();
      stopPhrase();
    };
  }, []);
  useEffect(() => {
    let previous = useWalletStore.getState();
    const unsubscribe = useWalletStore.subscribe((state) => {
      const before = previous;
      previous = state;
      if (state.status === 'ready' && state.syncCount !== before.syncCount) {
        void reportWallet();
      }
    });
    const timer = setInterval(() => {
      if (useWalletStore.getState().status === 'ready') {
        void refreshWallet({ ensureSynced: true, ignoreFailure: true });
      }
    }, WALLET_REPORT_INTERVAL_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);
  return null;
}
