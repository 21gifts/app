'use client';

import type { ReactElement } from 'react';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useWalletPhrase } from '@/hooks/useWalletPhrase';

/**
 * Signed-in wallet screen: recovery phrase activate / reveal / phrase.
 *
 * @returns The wallet card.
 */
export function WalletScreen(): ReactElement {
  return <WalletScreenView {...useWalletPhrase()} />;
}
