'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getMyLoans, type MyLoans } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Current loans body and an explicit reload action. */
export interface UseMyLoansResult {
  /** Last good body of GET /me/loans, or null before one loads or while signed out. */
  loans: MyLoans | null;
  /** Reads again; resolves with the applied body, or null on failure or when stale. */
  reload: () => Promise<MyLoans | null>;
}

type Listener = () => void;

let sharedSession = useAuthStore.getState().session;
let sharedLoans: MyLoans | null = null;
let sharedLoaded = false;
let sessionGeneration = 0;
let nextRequest = 0;
let latestAppliedRequest = 0;
let initialRead: { generation: number; promise: Promise<MyLoans | null> } | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function resetSession(session: string | null): void {
  if (session === sharedSession) {
    return;
  }
  sharedSession = session;
  sharedLoans = null;
  sharedLoaded = false;
  sessionGeneration += 1;
  latestAppliedRequest = 0;
  initialRead = null;
  notify();
}

useAuthStore.subscribe((state) => {
  resetSession(state.session);
});

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function serverSnapshot(): null {
  return null;
}

async function readLoans(session: string): Promise<MyLoans | null> {
  const generation = sessionGeneration;
  const request = ++nextRequest;
  try {
    const body = await getMyLoans(session);
    if (
      sharedSession !== session ||
      sessionGeneration !== generation ||
      request <= latestAppliedRequest
    ) {
      return null;
    }
    latestAppliedRequest = request;
    sharedLoans = body;
    sharedLoaded = true;
    notify();
    return body;
  } catch {
    return null;
  }
}

function loadInitial(session: string): void {
  /* v8 ignore next 3 -- The auth subscription resets before React runs this session's effect. */
  if (sharedSession !== session) {
    return;
  }
  if (sharedLoaded) {
    return;
  }
  const generation = sessionGeneration;
  if (initialRead?.generation === generation) {
    return;
  }
  const promise = readLoans(session);
  initialRead = { generation, promise };
  void promise.finally(() => {
    if (initialRead?.promise === promise) {
      initialRead = null;
    }
  });
}

/**
 * Shares the signed-in member's last good loans body between every mounted
 * consumer. The first consumer reads it; explicit reloads always read again.
 * A session change clears the shared body, failed reads preserve it, and stale
 * responses cannot replace a newer applied body.
 *
 * @returns The shared current loans body and an explicit reload action.
 */
export function useMyLoans(): UseMyLoansResult {
  const session = useAuthStore((state) => state.session);
  const loans = useSyncExternalStore(
    subscribe,
    () => (sharedSession === session ? sharedLoans : null),
    serverSnapshot,
  );

  const reload = useCallback(async (): Promise<MyLoans | null> => {
    if (session === null) {
      return null;
    }
    return readLoans(session);
  }, [session]);

  useEffect(() => {
    if (session !== null) {
      loadInitial(session);
    }
  }, [session]);

  return { loans, reload };
}
