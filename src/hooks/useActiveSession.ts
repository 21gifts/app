'use client';

import { useWalletOpen } from '@/hooks/useWalletOpen';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The session token public pages may act with: the store session, except
 * `null` while an account is set whose wallet is not open in this tab yet (a
 * login still opening its wallet counts as signed out). A held-back session
 * is `null` in the store already, and an account that cannot hold a wallet
 * counts as open.
 *
 * @returns The usable session token, or `null`.
 */
export function useActiveSession(): string | null {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const walletOpen = useWalletOpen();
  return account !== null && !walletOpen ? null : session;
}
