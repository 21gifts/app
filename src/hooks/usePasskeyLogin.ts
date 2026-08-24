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
  /** Create a new discoverable passkey and sign in. */
  register: () => void;
  /** Sign in with an existing passkey. */
  authenticate: () => void;
  /** Repeat the last register or authenticate attempt after an error. */
  retry: () => void;
  /** Aborts an in-flight WebAuthn prompt so another login method can start. */
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
 * Drives passkey register / authenticate. A run id ignores superseded clicks.
 *
 * @returns Status plus register, authenticate, retry, and cancel.
 */
export function usePasskeyLogin(): UsePasskeyLogin {
  const [status, setStatus] = useState<PasskeyStatus>('idle');
  const runIdRef = useRef(0);
  const lastKindRef = useRef<'register' | 'authenticate'>('register');
  const abortRef = useRef<AbortController | null>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const cancel = useCallback((): void => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
  }, []);

  const register = useCallback((): void => {
    lastKindRef.current = 'register';
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setStatus('starting');
    void (async () => {
      try {
        const begin = await startPasskeyRegistration();
        if (runId !== runIdRef.current) {
          return;
        }
        const credential = await navigator.credentials.create({
          publicKey: creationOptionsFromJSON(begin.options),
          signal: controller.signal,
        });
        if (runId !== runIdRef.current) {
          return;
        }
        if (credential === null || credential.type !== 'public-key') {
          throw new Error('Passkey creation returned no credential');
        }
        const session = await finishPasskeyRegistration(
          begin.challengeId,
          credentialToJSON(credential as PublicKeyCredential),
        );
        if (runId !== runIdRef.current) {
          return;
        }
        setAuth(session.token, session.account);
        setStatus('idle');
      } catch (error: unknown) {
        if (runId !== runIdRef.current) {
          return;
        }
        setStatus(isUserCancel(error) ? 'idle' : 'error');
      }
    })();
  }, [setAuth]);

  const authenticate = useCallback((): void => {
    lastKindRef.current = 'authenticate';
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    setStatus('starting');
    void (async () => {
      try {
        const begin = await startPasskeyAuthentication();
        if (runId !== runIdRef.current) {
          return;
        }
        const credential = await navigator.credentials.get({
          publicKey: requestOptionsFromJSON(begin.options),
          signal: controller.signal,
        });
        if (runId !== runIdRef.current) {
          return;
        }
        if (credential === null || credential.type !== 'public-key') {
          throw new Error('Passkey assertion returned no credential');
        }
        const session = await finishPasskeyAuthentication(
          begin.challengeId,
          credentialToJSON(credential as PublicKeyCredential),
        );
        if (runId !== runIdRef.current) {
          return;
        }
        setAuth(session.token, session.account);
        setStatus('idle');
      } catch (error: unknown) {
        if (runId !== runIdRef.current) {
          return;
        }
        setStatus(isUserCancel(error) ? 'idle' : 'error');
      }
    })();
  }, [setAuth]);

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

  return { status, register, authenticate, retry, cancel };
}
