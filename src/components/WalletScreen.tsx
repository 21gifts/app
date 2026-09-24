'use client';

import type { ReactElement } from 'react';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useWalletPhrase } from '@/hooks/useWalletPhrase';

/**
 * Signed-in wallet screen: add recovery phrase, reveal, or phrase grid.
 *
 * @returns The wallet card.
 */
export function WalletScreen(): ReactElement {
  return <WalletScreenView {...useWalletPhrase()} />;
}
