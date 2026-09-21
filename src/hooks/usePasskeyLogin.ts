'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  isWrongAccountError,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  WRONG_ACCOUNT_ERROR,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { clearSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { mnemonicFromPrfFirst, obtainPrfFirst } from '@/lib/prf-mnemonic';
import {
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Discrete states of the passkey login flow.
 *
 * `choice` is the account question after `login()` gets `NotAllowedError`
 * outside an in-app browser.
 */
export type PasskeyStatus = 'idle' | 'starting' | 'error' | 'unsupported' | 'choice';

/** Public surface returned by {@link usePasskeyLogin}. */
export interface UsePasskeyLogin {
  /** Where the passkey flow currently is. */
  status: PasskeyStatus;
  /**
   * Authenticate with an existing discoverable passkey. On `NotAllowedError`
   * outside an in-app browser, status becomes `choice` instead of creating
   * an account.
   */
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
 * True on iOS/iPadOS WebKit, including iPadOS desktop-site mode
 * (`Macintosh` UA + `MacIntel` + more than one touch point). Missing
 * `navigator` is false. Bare `Macintosh` without touch points stays
 * desktop Safari so cancel/unmount still pass AbortSignal.
 *
 * @returns Whether WebAuthn should omit AbortSignal.
 */
function isIosWebAuthnHost(): boolean {
  /* v8 ignore next 3 -- client hook: navigator exists whenever this runs */
  if (typeof navigator === 'undefined') {
    return false;
  }
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return true;
  }
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
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
  const choiceOfferedRef = useRef(false);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setWrongAccount = useAuthStore((state) => state.setWrongAccount);

  const guard = useCallback((runId: number): void => {
    if (runId !== runIdRef.current) {
      throw new SupersededError();
    }
  }, []);

  const cancel = useCallback((): void => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    choiceOfferedRef.current = false;
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
      const publicKey = creationOptionsFromJSON(begin.options);
      publicKey.extensions = {
        ...(publicKey.extensions ?? {}),
        prf: (publicKey.extensions as { prf?: object } | undefined)?.prf ?? {},
      };
      const request: CredentialCreationOptions = { publicKey };
      if (!isIosWebAuthnHost()) {
        request.signal = controller.signal;
      }
      const credential = await navigator.credentials.create(request);
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        throw new Error('Passkey creation returned no credential');
      }
      const publicKeyCredential = credential as PublicKeyCredential;
      const prfFirst = await obtainPrfFirst(publicKeyCredential);
      guard(runId);
      if (prfFirst === null) {
        throw new Error('wallet.prfUnsupported');
      }
      const mnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      guard(runId);
      const session = await finishPasskeyRegistration(
        begin.challengeId,
        credentialToJSON(publicKeyCredential),
      );
      guard(runId);
      rememberSessionPhrase(mnemonic);
      setAuth(session.token, session.account);
      choiceOfferedRef.current = false;
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
      const request: CredentialRequestOptions = {
        publicKey: requestOptionsFromJSON(begin.options),
      };
      if (!isIosWebAuthnHost()) {
        request.signal = controller.signal;
      }
      const credential = await navigator.credentials.get(request);
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
      choiceOfferedRef.current = false;
      setLastError(null);
      setStatus('idle');
    },
    [guard, setAuth],
  );

  const finishWithError = useCallback(
    (runId: number, error: unknown): void => {
      if (error instanceof SupersededError || runId !== runIdRef.current) {
        return;
      }
      if (isUserCancel(error)) {
        setLastError(null);
        setStatus(choiceOfferedRef.current ? 'choice' : 'idle');
        return;
      }
      if (isWrongAccountError(error)) {
        clearAuth();
        setWrongAccount(true);
        setLastError(WRONG_ACCOUNT_ERROR);
        setStatus('error');
        return;
      }
      setLastError(error instanceof Error ? error.message : String(error));
      setStatus('error');
    },
    [clearAuth, setWrongAccount],
  );

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
    clearSessionPhrase();
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
    clearSessionPhrase();
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
        choiceOfferedRef.current = true;
        setLastError(null);
        setStatus('choice');
      }
    })();
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
    register(lastViewKeyRef.current);
  }, [authenticate, login, register]);

  useEffect(() => {
    return (): void => {
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      choiceOfferedRef.current = false;
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
