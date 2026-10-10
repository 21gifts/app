'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMyLoans, type MyLoans } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Current loans body and an explicit reload action. */
export interface UseMyLoansResult {
  /** Body of GET /me/loans, or null while loading, signed out, or after a failed read. */
  loans: MyLoans | null;
  /** Reads again; resolves with the new body or null on failure (state updated either way). */
  reload: () => Promise<MyLoans | null>;
}

/**
 * Reads the signed-in member's loans on mount and whenever the session changes.
 *
 * @returns The current loans body and a reload action; stale and failed reads yield null.
 */
export function useMyLoans(): UseMyLoansResult {
  const session = useAuthStore((state) => state.session);
  const [loans, setLoans] = useState<MyLoans | null>(null);
  const generation = useRef(0);

  const reload = useCallback(async (): Promise<MyLoans | null> => {
    const run = ++generation.current;
    if (session === null) {
      setLoans(null);
      return null;
    }
    try {
      const body = await getMyLoans(session);
      if (run !== generation.current) {
        return null;
      }
      setLoans(body);
      return body;
    } catch {
      if (run === generation.current) {
        setLoans(null);
      }
      return null;
    }
  }, [session]);

  useEffect(() => {
    setLoans(null);
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);

  return { loans, reload };
}
