'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from '@/lib/api';
import {
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/** Discrete states of the passkey login flow. */
export type PasskeyStatus = 'idle' | 'starting' | 'error';

/** Public surface returned by {@link usePasskeyLogin}. */
export interface UsePasskeyLogin {
  /** Where the passkey flow currently is. */
  status: PasskeyStatus;
  /** One-tap login: existing passkey, or create when the browser has none. */
  login: () => void;
  /** Create a new discoverable passkey and sign in. */
  register: () => void;
  /** Sign in with an existing passkey. */
  authenticate: () => void;
  /** Repeats the originating flow after an error. */
  retry: () => void;
  /** Aborts an in-flight WebAuthn prompt. */
  cancel: () => void;
}

/**
 * Whether this run was aborted by the app (`AbortController.abort()`).
 *
 * Picker dismiss (`NotAllowedError`) is a failure so the visitor can try
 * login again or register. Programmatic abort stays idle.
 *
 * @param error - Unknown rejection.
 * @returns True when this run was aborted by the app.
 */
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Thrown when a newer click or unmount superseded this ceremony.
 */
class SupersededError extends Error {
  /**
   * @returns A stale-run error.
   */
  public constructor() {
    super('passkey run superseded');
    this.name = 'SupersededError';
  }
}

/**
 * Drives passkey register / authenticate. A run id ignores superseded clicks.
 *
 * @returns Status plus login, register, authenticate, retry, and cancel.
 */
export function usePasskeyLogin(): UsePasskeyLogin {
  const [status, setStatus] = useState<PasskeyStatus>('idle');
  const runIdRef = useRef(0);
  const lastKindRef = useRef<'register' | 'authenticate'>('authenticate');
  const entryKindRef = useRef<'login' | 'register' | 'authenticate'>('login');
  const abortRef = useRef<AbortController | null>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const guard = useCallback((runId: number): void => {
    if (runId !== runIdRef.current) {
      throw new SupersededError();
    }
  }, []);

  const cancel = useCallback((): void => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  const beginRun = useCallback(
    (
      kind: 'register' | 'authenticate',
    ): {
      runId: number;
      controller: AbortController;
    } => {
      lastKindRef.current = kind;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const runId = ++runIdRef.current;
      setStatus('starting');
      return { runId, controller };
    },
    [],
  );

  const completeRegistration = useCallback(
    async (runId: number, controller: AbortController): Promise<void> => {
      guard(runId);
      const begin = await startPasskeyRegistration();
      guard(runId);
      const credential = await navigator.credentials.create({
        publicKey: creationOptionsFromJSON(begin.options),
        signal: controller.signal,
      });
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        throw new Error('Passkey creation returned no credential');
      }
      const session = await finishPasskeyRegistration(
        begin.challengeId,
        credentialToJSON(credential as PublicKeyCredential),
      );
      guard(runId);
      setAuth(session.token, session.account);
      setStatus('idle');
    },
    [guard, setAuth],
  );

  const completeAuthentication = useCallback(
    async (runId: number, controller: AbortController): Promise<void> => {
      guard(runId);
      const begin = await startPasskeyAuthentication();
      guard(runId);
      const credential = await navigator.credentials.get({
        publicKey: requestOptionsFromJSON(begin.options),
        signal: controller.signal,
      });
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        throw new Error('Passkey assertion returned no credential');
      }
      const session = await finishPasskeyAuthentication(
        begin.challengeId,
        credentialToJSON(credential as PublicKeyCredential),
      );
      guard(runId);
      setAuth(session.token, session.account);
      setStatus('idle');
    },
    [guard, setAuth],
  );

  const finishWithError = useCallback((runId: number, error: unknown): void => {
    if (error instanceof SupersededError || runId !== runIdRef.current) {
      return;
    }
    setStatus(isAbort(error) ? 'idle' : 'error');
  }, []);

  const register = useCallback((): void => {
    entryKindRef.current = 'register';
    const { runId, controller } = beginRun('register');
    void completeRegistration(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeRegistration, finishWithError]);

  const authenticate = useCallback((): void => {
    entryKindRef.current = 'authenticate';
    const { runId, controller } = beginRun('authenticate');
    void completeAuthentication(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeAuthentication, finishWithError]);

  const login = useCallback((): void => {
    entryKindRef.current = 'login';
    const { runId, controller } = beginRun('authenticate');
    void completeAuthentication(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeAuthentication, finishWithError]);

  const retry = useCallback((): void => {
    if (entryKindRef.current === 'login') {
      login();
      return;
    }
    if (lastKindRef.current === 'authenticate') {
      authenticate();
      return;
    }
    register();
  }, [authenticate, login, register]);

  useEffect(() => {
    return (): void => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return { status, login, register, authenticate, retry, cancel };
}
