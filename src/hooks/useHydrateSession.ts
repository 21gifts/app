'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchMe } from '@/lib/api';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Rehydrates a persisted session token into the auth store.
 *
 * A valid token logs the visitor in unless a newer in-page session already
 * won. A rejected token calls `clearAuth` when the in-memory session is
 * absent or still that token. Unmount invalidates in-flight hydration.
 *
 * @returns Whether this mount has finished checking storage / `/me`.
 */
export function useHydrateSession(): { ready: boolean } {
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
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
        setAuth(token, maybeAccount);
      })
      .catch((error: unknown) => {
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
  }, [setAuth, clearAuth]);

  return { ready };
}
