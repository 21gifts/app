'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchMe, isWrongAccountError } from '@/lib/api';
import { loadSession } from '@/lib/session-storage';
import { hydratesLocked } from '@/lib/wallet/wallet-open';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Rehydrates a persisted session token into the auth store.
 *
 * A valid token logs the visitor in unless a newer in-page session already
 * won. When the account's wallet is not open in this tab (the phrase lives in
 * tab memory only, so after a reload, in a new tab, or in a reopened app), the
 * token is held as `lockedSession` instead (with the account's display name as
 * `lockedName`): the visitor counts as logged out until a login opens the
 * wallet. A rejected token calls `clearAuth` when the in-memory session is
 * absent or still that token. `WrongAccountError` also sets `wrongAccount`
 * so `/login` can show the retry hint. Unmount invalidates in-flight hydration.
 *
 * @returns Whether this mount has finished checking storage / `/me`.
 */
export function useHydrateSession(): { ready: boolean } {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setLockedSession = useAuthStore((state) => state.setLockedSession);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setWrongAccount = useAuthStore((state) => state.setWrongAccount);
  const hydrateGen = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = loadSession();
    if (token === null) {
      setReady(true);
      return;
    }
    const gen = hydrateGen.current;
    fetchMe(token)
      .then((maybeAccount) => {
        if (gen !== hydrateGen.current) {
          return;
        }
        const current = useAuthStore.getState();
        if (loadSession() !== token) {
          return;
        }
        if (current.session !== null && current.session !== token) {
          return;
        }
        if (maybeAccount === null) {
          if (current.session === null || current.session === token) {
            clearAuth();
          }
          return;
        }
        if (current.session === token && current.account !== null) {
          return;
        }
        if (hydratesLocked(maybeAccount)) {
          setLockedSession(token, maybeAccount);
          return;
        }
        setAuth(token, maybeAccount);
      })
      .catch((error: unknown) => {
        if (isWrongAccountError(error)) {
          if (gen !== hydrateGen.current) {
            return;
          }
          if (loadSession() !== token) {
            return;
          }
          const current = useAuthStore.getState();
          if (current.session !== null && current.session !== token) {
            return;
          }
          clearAuth();
          setWrongAccount(true);
          return;
        }
        console.error('Session hydration failed', error);
      })
      .finally(() => {
        if (gen === hydrateGen.current) {
          setReady(true);
        }
      });
    return (): void => {
      hydrateGen.current += 1;
    };
  }, [setAuth, setLockedSession, clearAuth, setWrongAccount]);

  return { ready };
}
