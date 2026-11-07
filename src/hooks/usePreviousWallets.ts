'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchPreviousWallets } from '@/lib/api';
import type { PreviousWallet } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** The previous wallets of the signed-in account and how their read went. */
export interface UsePreviousWalletsResult {
  /** `loading` until the read settles, then `ready` or `error`. */
  status: 'loading' | 'ready' | 'error';
  /** The previous wallets as the api orders them; empty unless `ready`. */
  wallets: PreviousWallet[];
  /** Reads the list again, after an error. */
  retry: () => void;
}

/** A read that settled: the list, or that it failed. */
type Settled = { status: 'ready'; wallets: PreviousWallet[] } | { status: 'error' };

/**
 * The wallets the signed-in account used before a social recovery, read once
 * per mount with `GET /me/previous-wallets`. Only an account with a verified
 * wallet can have one (a recovery keeps the wallet verified), so for any other
 * account, or without a session, nothing is read and the list is empty and
 * `ready`. The list only informs and links: nothing here removes a wallet.
 * Each balance is the public explorer balance the api read, or `null` when it
 * is unknown. An answer that arrives after unmount, or after a newer read
 * started, is dropped.
 *
 * @returns Status, wallets, and a retry that reads again.
 */
export function usePreviousWallets(): UsePreviousWalletsResult {
  const session = useAuthStore((state) =>
    state.account?.sparkWalletVerified === true ? state.session : null,
  );
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    session: string;
    attempt: number;
    result: Settled;
  } | null>(null);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    fetchPreviousWallets(session).then(
      (wallets) => {
        if (!cancelled) {
          setSettled({ session, attempt, result: { status: 'ready', wallets } });
        }
      },
      () => {
        if (!cancelled) {
          setSettled({ session, attempt, result: { status: 'error' } });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  const retry = useCallback((): void => {
    setAttempt((current) => current + 1);
  }, []);

  if (session === null) {
    return { status: 'ready', wallets: [], retry };
  }
  if (settled === null || settled.session !== session || settled.attempt !== attempt) {
    return { status: 'loading', wallets: [], retry };
  }
  return settled.result.status === 'ready'
    ? { status: 'ready', wallets: settled.result.wallets, retry }
    : { status: 'error', wallets: [], retry };
}
