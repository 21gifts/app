'use client';

import { useEffect } from 'react';
import { listenForWalletPhrase } from '@/lib/wallet/wallet-service';

/**
 * Keeps the wallet connection synchronized with the tab-memory phrase.
 *
 * @returns `null` because the root listener has no visual surface.
 */
export function WalletSync(): null {
  useEffect(() => listenForWalletPhrase(), []);
  return null;
}
