'use client';

import { useEffect } from 'react';
import { listenForWalletPhrase } from '@/lib/wallet/wallet-service';
import { listenForWalletSetup } from '@/lib/wallet/wallet-setup';

/**
 * Keeps the wallet connection synchronized with the tab-memory phrase, and
 * runs the one-time wallet setup in the background once the phrase is there
 * and the account needs it. The phrase listener is added first, so it opens
 * the connection the setup then reuses.
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
  return null;
}
