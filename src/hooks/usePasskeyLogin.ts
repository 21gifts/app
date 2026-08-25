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
  /** Repeat the last register or authenticate attempt after an error. */
  retry: () => void;
  /** Aborts an in-flight WebAuthn prompt. */
  cancel: () => void;
}

/**
 * Whether the user dismissed the WebAuthn prompt (not an app error).
 *
 * Picker dismiss is `NotAllowedError`; `AbortController.abort()` is
 * `AbortError`. Both return the visitor to idle rather than the error card.
 *
 * @param error - Unknown rejection.
 * @returns True when the ceremony was dismissed.
 */
function isUserCancel(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'AbortError')
  );
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
    setStatus(isUserCancel(error) ? 'idle' : 'error');
  }, []);

  const register = useCallback((): void => {
    const { runId, controller } = beginRun('register');
    void completeRegistration(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeRegistration, finishWithError]);

  const authenticate = useCallback((): void => {
    const { runId, controller } = beginRun('authenticate');
    void completeAuthentication(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeAuthentication, finishWithError]);

  const login = useCallback((): void => {
    const { runId, controller } = beginRun('authenticate');
    void (async () => {
      try {
        await completeAuthentication(runId, controller);
      } catch (error: unknown) {
        if (error instanceof SupersededError || runId !== runIdRef.current) {
          return;
        }
        const noPasskey = error instanceof DOMException && error.name === 'NotAllowedError';
        if (!noPasskey) {
          finishWithError(runId, error);
          return;
        }
        lastKindRef.current = 'register';
        const createController = new AbortController();
        abortRef.current = createController;
        try {
          await completeRegistration(runId, createController);
        } catch (createError: unknown) {
          finishWithError(runId, createError);
        }
      }
    })();
  }, [beginRun, completeAuthentication, completeRegistration, finishWithError]);

  const retry = useCallback((): void => {
    if (lastKindRef.current === 'authenticate') {
      authenticate();
      return;
    }
    register();
  }, [authenticate, register]);

  useEffect(() => {
    return (): void => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return { status, login, register, authenticate, retry, cancel };
}
