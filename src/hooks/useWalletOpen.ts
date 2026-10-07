'use client';

import { useSyncExternalStore } from 'react';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import { isWalletOpen } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Subscribes to tab-phrase changes.
 *
 * @param onChange - Called when the phrase is remembered or cleared.
 * @returns Unsubscribe function.
 */
function subscribePhrase(onChange: () => void): () => void {
  window.addEventListener(SESSION_PHRASE_EVENT, onChange);
  return () => {
    window.removeEventListener(SESSION_PHRASE_EVENT, onChange);
  };
}

/**
 * Whether the tab holds the recovery phrase.
 *
 * @returns `true` while the phrase is in tab memory.
 */
function hasPhraseSnapshot(): boolean {
  return peekSessionPhrase() !== null;
}

/**
 * Server snapshot: the server never holds the phrase.
 *
 * @returns `false`.
 */
function hasPhraseServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the visitor counts as signed in on a signed-in screen: a session
 * whose wallet is open in this tab (`isWalletOpen`). `false` while signed
 * out, while a stored session is held back as `lockedSession`, and right
 * after a login until its phrase is in tab memory.
 *
 * @returns Whether the signed-in screens may show.
 */
export function useWalletOpen(): boolean {
  const account = useAuthStore((state) => state.account);
  const hasPhrase = useSyncExternalStore(
    subscribePhrase,
    hasPhraseSnapshot,
    hasPhraseServerSnapshot,
  );
  return account !== null && isWalletOpen(account, hasPhrase);
}
