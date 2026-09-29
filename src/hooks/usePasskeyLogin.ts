'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  finishPasskeyAuthentication,
  finishPasskeyRegistration,
  isUnknownCredentialError,
  isWrongAccountError,
  startPasskeyAuthentication,
  startPasskeyRegistration,
  WRONG_ACCOUNT_ERROR,
} from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { clearSessionPhrase } from '@/lib/tab-phrase';
import { obtainPrfFirst, prfEvalFirstSalt } from '@/lib/prf-mnemonic';
import {
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { reportDiagnostic } from '@/lib/diagnostics';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Discrete states of the passkey login flow.
 *
 * `choice` is the account question after `login()` gets `NotAllowedError`
 * outside an in-app browser.
 *
 * `unknown` is authenticate finish rejected the credential the phone offered
 * because the server returned `Unknown credential`.
 */
export type PasskeyStatus = 'idle' | 'starting' | 'error' | 'unsupported' | 'choice' | 'unknown';

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
 * `AbortError`. Both return to `unknown` while that card was shown, else
 * `choice` when a choice was offered, else idle rather than the error card.
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
 * Best-effort `PublicKeyCredential.signalUnknownCredential`. Missing or
 * rejecting implementations are ignored.
 *
 * @param rpId - Ceremony relying-party id.
 * @param credentialId - Base64url credential id.
 */
async function signalUnknownCredential(rpId: string, credentialId: string): Promise<void> {
  try {
    const ctor = globalThis.PublicKeyCredential as unknown as
      | {
          signalUnknownCredential?: (options: {
            rpId: string;
            credentialId: string;
          }) => Promise<void>;
        }
      | null
      | undefined;
    if (ctor === undefined || ctor === null) {
      return;
    }
    const signal = ctor.signalUnknownCredential;
    if (typeof signal !== 'function') {
      return;
    }
    await signal.call(ctor, { rpId, credentialId });
  } catch {
    return;
  }
}

function diagnosticName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return undefined;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function diagnosticMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return undefined;
  }
  const message = (error as { message: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function accountIdFromOptions(options: Record<string, unknown>): string | undefined {
  const user = options['user'];
  if (user === null || typeof user !== 'object') {
    return undefined;
  }
  const name = (user as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
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
  const unknownOfferedRef = useRef(false);
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
    unknownOfferedRef.current = false;
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
      let begin: Awaited<ReturnType<typeof startPasskeyRegistration>>;
      try {
        begin = await startPasskeyRegistration(viewKey);
      } catch (error: unknown) {
        reportDiagnostic({
          event: 'client.passkey.register.begin',
          stage: 'register',
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        throw error;
      }
      guard(runId);
      reportDiagnostic({
        event: 'client.passkey.register.begin',
        stage: 'register',
        challengeId: begin.challengeId,
        accountId: accountIdFromOptions(begin.options),
      });
      const publicKey = creationOptionsFromJSON(begin.options);
      const salt = await prfEvalFirstSalt();
      const first = new Uint8Array(salt.byteLength);
      first.set(salt);
      publicKey.extensions = {
        ...(publicKey.extensions ?? {}),
        prf: { eval: { first } },
      };
      const request: CredentialCreationOptions = { publicKey };
      if (!isIosWebAuthnHost()) {
        request.signal = controller.signal;
      }
      let credential: Credential | null;
      try {
        credential = await navigator.credentials.create(request);
      } catch (error: unknown) {
        reportDiagnostic(
          isUserCancel(error)
            ? { event: 'client.passkey.cancel', stage: 'register', name: diagnosticName(error) }
            : {
                event: 'client.passkey.register.ceremony',
                stage: 'register',
                name: diagnosticName(error),
                message: diagnosticMessage(error),
              },
        );
        throw error;
      }
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        const error = new Error('Passkey creation returned no credential');
        reportDiagnostic({
          event: 'client.passkey.register.ceremony',
          stage: 'register',
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        throw error;
      }
      const publicKeyCredential = credential as PublicKeyCredential;
      let prfFirst: Uint8Array | null;
      try {
        prfFirst = await obtainPrfFirst(publicKeyCredential);
      } catch (error: unknown) {
        reportDiagnostic(
          isUserCancel(error)
            ? { event: 'client.passkey.cancel', stage: 'register', name: diagnosticName(error) }
            : {
                event: 'client.passkey.register.ceremony',
                stage: 'register',
                name: diagnosticName(error),
                message: diagnosticMessage(error),
              },
        );
        throw error;
      }
      guard(runId);
      if (prfFirst === null) {
        reportDiagnostic({
          event: 'client.passkey.register.prf',
          prfPresent: false,
          stage: 'register',
        });
        throw new Error('wallet.prfUnsupported');
      }
      reportDiagnostic({
        event: 'client.passkey.register.prf',
        prfPresent: true,
        stage: 'register',
      });
      let session: Awaited<ReturnType<typeof finishPasskeyRegistration>>;
      try {
        session = await finishPasskeyRegistration(
          begin.challengeId,
          credentialToJSON(publicKeyCredential),
        );
      } catch (error: unknown) {
        reportDiagnostic({
          event: 'client.passkey.register.finish',
          stage: 'register',
          challengeId: begin.challengeId,
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        throw error;
      }
      guard(runId);
      setAuth(session.token, session.account);
      choiceOfferedRef.current = false;
      unknownOfferedRef.current = false;
      setLastError(null);
      setStatus('idle');
    },
    [guard, setAuth],
  );

  const completeAuthentication = useCallback(
    async (runId: number, controller: AbortController): Promise<void> => {
      guard(runId);
      let begin: Awaited<ReturnType<typeof startPasskeyAuthentication>>;
      try {
        begin = await startPasskeyAuthentication();
      } catch (error: unknown) {
        reportDiagnostic({
          event: 'client.passkey.authenticate.begin',
          stage: 'authenticate',
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        throw error;
      }
      guard(runId);
      reportDiagnostic({
        event: 'client.passkey.authenticate.begin',
        stage: 'authenticate',
        challengeId: begin.challengeId,
      });
      const request: CredentialRequestOptions = {
        publicKey: requestOptionsFromJSON(begin.options),
      };
      if (!isIosWebAuthnHost()) {
        request.signal = controller.signal;
      }
      let credential: Credential | null;
      try {
        credential = await navigator.credentials.get(request);
      } catch (error: unknown) {
        reportDiagnostic(
          isUserCancel(error)
            ? {
                event: 'client.passkey.cancel',
                stage: 'authenticate',
                name: diagnosticName(error),
              }
            : {
                event: 'client.passkey.authenticate.ceremony',
                stage: 'authenticate',
                name: diagnosticName(error),
                message: diagnosticMessage(error),
              },
        );
        throw error;
      }
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        const error = new Error('Passkey assertion returned no credential');
        reportDiagnostic({
          event: 'client.passkey.authenticate.ceremony',
          stage: 'authenticate',
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        throw error;
      }
      const publicKeyCredential = credential as PublicKeyCredential;
      let session: Awaited<ReturnType<typeof finishPasskeyAuthentication>>;
      try {
        session = await finishPasskeyAuthentication(
          begin.challengeId,
          credentialToJSON(publicKeyCredential),
        );
      } catch (error: unknown) {
        reportDiagnostic({
          event: 'client.passkey.authenticate.finish',
          stage: 'authenticate',
          challengeId: begin.challengeId,
          name: diagnosticName(error),
          message: diagnosticMessage(error),
        });
        if (isUnknownCredentialError(error)) {
          const rpIdRaw = begin.options['rpId'];
          const rpId = typeof rpIdRaw === 'string' && rpIdRaw !== '' ? rpIdRaw : '';
          const credentialId = publicKeyCredential.id;
          if (rpId !== '' && credentialId !== '') {
            await signalUnknownCredential(rpId, credentialId);
          }
        }
        throw error;
      }
      guard(runId);
      setAuth(session.token, session.account);
      choiceOfferedRef.current = false;
      unknownOfferedRef.current = false;
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
        setStatus(
          unknownOfferedRef.current ? 'unknown' : choiceOfferedRef.current ? 'choice' : 'idle',
        );
        return;
      }
      if (isWrongAccountError(error)) {
        clearAuth();
        setWrongAccount(true);
        setLastError(WRONG_ACCOUNT_ERROR);
        setStatus('error');
        return;
      }
      if (isUnknownCredentialError(error)) {
        unknownOfferedRef.current = true;
        setLastError(null);
        setStatus('unknown');
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
      unknownOfferedRef.current = false;
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
