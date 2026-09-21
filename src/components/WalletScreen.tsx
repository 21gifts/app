'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { WalletScreenView } from '@/components/WalletScreenView';
import { useWalletPhrase } from '@/hooks/useWalletPhrase';

/**
 * Signed-in wallet screen: recovery phrase confirm / activate / reveal.
 *
 * @returns The wallet card.
 */
export function WalletScreen(): ReactElement {
  const phrase = useWalletPhrase();
  const { view, words, showPhrase, status, error, retry } = phrase;
  const autoRevealRef = useRef(false);

  useEffect(() => {
    if (view !== 'confirm' || words.length === 12 || status !== 'idle' || error !== null) {
      return;
    }
    /* v8 ignore next 3 -- second effect after auto-reveal on the same mount */
    if (autoRevealRef.current) {
      return;
    }
    autoRevealRef.current = true;
    void showPhrase();
  }, [view, words.length, status, error, showPhrase]);

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
