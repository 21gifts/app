'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useWalletPhrase } from '@/hooks/useWalletPhrase';

/**
 * Signed-in wallet screen: recovery phrase setup / activate / reveal.
 *
 * @returns The wallet card.
 */
export function WalletScreen(): ReactElement {
  const phrase = useWalletPhrase();
  const { view, words, showPhrase, status, error, retry, setupWallet } = phrase;
  const autoRevealRef = useRef(false);

  useEffect(() => {
    const needsWords = (view === 'confirm' || setupWallet) && words.length !== 12;
    if (!needsWords || status !== 'idle' || error !== null) {
      return;
    }
    /* v8 ignore next 3 -- second effect after auto-reveal on the same mount */
    if (autoRevealRef.current) {
      return;
    }
    autoRevealRef.current = true;
    void showPhrase();
  }, [view, words.length, status, error, showPhrase, setupWallet]);

  return (
    <WalletScreenView
      {...phrase}
      retry={() => {
        autoRevealRef.current = false;
        retry();
      }}
    />
  );
}
