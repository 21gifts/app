'use client';

import { useCallback, useRef, useState } from 'react';
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
}

/**
 * Whether the user cancelled the WebAuthn prompt (not an app error).
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
 * @returns Status plus the two start actions.
 */
export function usePasskeyLogin(): UsePasskeyLogin {
  const [status, setStatus] = useState<PasskeyStatus>('idle');
  const runIdRef = useRef(0);
  const lastKindRef = useRef<'register' | 'authenticate'>('register');
  const setAuth = useAuthStore((state) => state.setAuth);

  const register = useCallback((): void => {
    lastKindRef.current = 'register';
    const runId = ++runIdRef.current;
    setStatus('starting');
    void (async () => {
      try {
        const begin = await startPasskeyRegistration();
        const credential = await navigator.credentials.create({
          publicKey: creationOptionsFromJSON(begin.options),
        });
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
    const runId = ++runIdRef.current;
    setStatus('starting');
    void (async () => {
      try {
        const begin = await startPasskeyAuthentication();
        const credential = await navigator.credentials.get({
          publicKey: requestOptionsFromJSON(begin.options),
        });
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

  return { status, register, authenticate, retry };
}
