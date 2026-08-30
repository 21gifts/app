'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  startPasskeyAuthentication,
  startPasskeyRegistration,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import {
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/** Discrete states of the passkey login flow. */
export type PasskeyStatus = 'idle' | 'starting' | 'error' | 'unsupported';

/** Public surface returned by {@link usePasskeyLogin}. */
export interface UsePasskeyLogin {
  /** Where the passkey flow currently is. */
  status: PasskeyStatus;
  /** One-tap login: existing passkey, or create when the browser has none. */
  login: () => void;
  /**
   * Create a new discoverable passkey and sign in.
   * Optional `viewKey` claims an existing public profile during registration.
   */
  register: (viewKey?: string) => void;
  /** Sign in with an existing passkey. */
  authenticate: () => void;
  /** Repeats the originating flow after an error. The single-button path restarts login. */
  retry: () => void;
  /** Aborts an in-flight WebAuthn prompt. */
  cancel: () => void;
  /** Last `Error.message` when `status === 'error'`, otherwise `null`. */
  error: string | null;
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
 * @returns Status plus login, register, authenticate, retry, cancel, and error.
 */
export function usePasskeyLogin(): UsePasskeyLogin {
  const [status, setStatus] = useState<PasskeyStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const runIdRef = useRef(0);
  const lastKindRef = useRef<'register' | 'authenticate'>('authenticate');
  const entryKindRef = useRef<'login' | 'register' | 'authenticate'>('login');
  const lastViewKeyRef = useRef<string | undefined>(undefined);
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
    setLastError(null);
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
      setLastError(null);
      setStatus('starting');
      return { runId, controller };
    },
    [],
  );

  const completeRegistration = useCallback(
    async (runId: number, controller: AbortController, viewKey?: string): Promise<void> => {
      guard(runId);
      const begin = await startPasskeyRegistration(viewKey);
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
      setLastError(null);
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
      setLastError(null);
      setStatus('idle');
    },
    [guard, setAuth],
  );

  const finishWithError = useCallback((runId: number, error: unknown): void => {
    if (error instanceof SupersededError || runId !== runIdRef.current) {
      return;
    }
    if (isUserCancel(error)) {
      setLastError(null);
      setStatus('idle');
      return;
    }
    setLastError(error instanceof Error ? error.message : String(error));
    setStatus('error');
  }, []);

  const register = useCallback(
    (viewKey?: string): void => {
      if (isInAppBrowser()) {
        setStatus('unsupported');
        return;
      }
      entryKindRef.current = 'register';
      lastViewKeyRef.current = viewKey;
      const { runId, controller } = beginRun('register');
      void completeRegistration(runId, controller, viewKey).catch((error: unknown) => {
        finishWithError(runId, error);
      });
    },
    [beginRun, completeRegistration, finishWithError],
  );

  const authenticate = useCallback((): void => {
    if (isInAppBrowser()) {
      setStatus('unsupported');
      return;
    }
    entryKindRef.current = 'authenticate';
    const { runId, controller } = beginRun('authenticate');
    void completeAuthentication(runId, controller).catch((error: unknown) => {
      finishWithError(runId, error);
    });
  }, [beginRun, completeAuthentication, finishWithError]);

  const login = useCallback((): void => {
    if (isInAppBrowser()) {
      setStatus('unsupported');
      return;
    }
    entryKindRef.current = 'login';
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
        if (isInAppBrowser()) {
          setStatus('unsupported');
          return;
        }
        lastKindRef.current = 'register';
        lastViewKeyRef.current = undefined;
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
    if (entryKindRef.current === 'login') {
      login();
      return;
    }
    if (lastKindRef.current === 'authenticate') {
      authenticate();
      return;
    }
    register(lastViewKeyRef.current);
  }, [authenticate, login, register]);

  useEffect(() => {
    return (): void => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    status,
    login,
    register,
    authenticate,
    retry,
    cancel,
    error: status === 'error' ? lastError : null,
  };
}
