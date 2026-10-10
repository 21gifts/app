'use client';

import type { ReactElement } from 'react';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useWallet } from '@/hooks/useWallet';
import { useWalletPhrase } from '@/hooks/useWalletPhrase';
import { useWalletSend } from '@/hooks/useWalletSend';

/**
 * Signed-in `/wallet`: the balance and, while the wallet is ready, the
 * payments list, with Receive and Send below. The 12 words are not rendered
 * here, and the recovery entry is on `/settings`.
 *
 * @returns The wallet cards.
 */
export function WalletScreen(): ReactElement {
  const wallet = useWallet();
  const send = useWalletSend();
  return <WalletScreenView {...useWalletPhrase()} wallet={wallet} send={send} />;
}

/**
 * `/wallet/phrase`: the recovery phrase or its error, with no receive QR.
 *
 * @returns The recovery subpage.
 */
export function WalletPhraseScreen(): ReactElement {
  return <WalletScreenView surface="phrase" {...useWalletPhrase()} />;
}
