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
import { androidInstalledVersion, androidPasskeyBlock } from '@/lib/android-passkey';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { iosInstalledVersion, iosPasskeyBlock } from '@/lib/ios-passkey';
import { getBreezApiKey } from '@/lib/config';
import { clearSessionPhrase } from '@/lib/tab-phrase';
import { obtainPrfFirst, prfEvalFirstSalt, readPrfFirst } from '@/lib/prf-mnemonic';
import { rememberPhraseFromPrf } from '@/lib/wallet/wallet-phrase';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  creationOptionsFromJSON,
  credentialToJSON,
  requestOptionsFromJSON,
} from '@/lib/webauthn-browser';
import { reportDiagnostic, type DiagnosticReport } from '@/lib/diagnostics';
import { useAuthStore } from '@/stores/auth-store';

/** Exact api 409 when the chosen username is taken during register. */
const USERNAME_TAKEN = 'Username is already in use';

/** Exact api 400 when register-begin rejects the username charset or length. */
const USERNAME_INVALID = 'Username must be 1–32 characters of a-z, 0-9, hyphen, underscore, or dot';

/**
 * Trim, lowercase, then the api username charset and length.
 *
 * @param raw - The typed name.
 * @returns The normalized username, or `null` when it is empty or invalid.
 */
function normalizeUsername(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

/**
 * Discrete states of the passkey login flow.
 *
 * `choice` is the account question after `login()` gets `NotAllowedError`
 * outside an in-app browser when unknown was not offered.
 *
 * `unknown` is authenticate finish rejected the credential the phone offered
 * because the server returned `Unknown credential`.
 *
 * `name` is the username form after `register()` with no view key, before create.
 */
export type PasskeyStatus =
  'idle' | 'starting' | 'error' | 'unsupported' | 'choice' | 'unknown' | 'name';

/** Public surface returned by {@link usePasskeyLogin}. */
export interface UsePasskeyLogin {
  /** Where the passkey flow currently is. */
  status: PasskeyStatus;
  /**
   * Authenticate with an existing discoverable passkey. A dismissed
   * `NotAllowedError` stays on `unknown` when that card was already offered,
   * and becomes `choice` only when unknown was not offered.
   */
  login: () => void;
  /**
   * Create a new discoverable passkey and sign in.
   * With no view key, opens the name step and does not start the ceremony.
   * Optional `viewKey` claims an existing public profile during registration
   * and never shows the name step.
   */
  register: (viewKey?: string) => void;
  /**
   * Submit a typed name for a new account. Normalizes first; invalid input
   * stays on `name` and does not call the network.
   */
  submitName: (raw: string) => void;
  /** Sign in with an existing passkey. */
  authenticate: () => void;
  /**
   * After an error, a named create returns to the name form and does not
   * start create. `register(viewKey)` sends the same key. `authenticate`
   * repeats authenticate. The single login button repeats login.
   */
  retry: () => void;
  /** Aborts an in-flight WebAuthn prompt. */
  cancel: () => void;
  /** Last `Error.message` when `status === 'error'`, otherwise `null`. */
  error: string | null;
  /** Username problem while `status === 'name'`, otherwise `null`. */
  nameError: 'invalid' | 'taken' | null;
}

/**
 * Whether the user dismissed the WebAuthn prompt (not an app error).
 *
 * Picker dismiss is `NotAllowedError`; `AbortController.abort()` is
 * `AbortError`. A named create returns to `name`. Otherwise both return to
 * `unknown` while that card was shown, else `choice` when a choice was
 * offered, else idle rather than the error card.
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

/** Account id from base64url `user.id`. */
function accountIdFromOptions(options: Record<string, unknown>): string | undefined {
  const user = options['user'];
  if (user === null || typeof user !== 'object') {
    return undefined;
  }
  const id = (user as { id?: unknown }).id;
  if (typeof id !== 'string') {
    return undefined;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(id));
  } catch {
    return undefined;
  }
}

/**
 * True when this iPhone or iPad is too old to finish passkey sign-in.
 *
 * @returns Whether register must fail with `login.iosVersion`.
 */
function iosRegisterBlocked(): boolean {
  /* v8 ignore next 3 -- client hook: navigator exists whenever this runs */
  if (typeof navigator === 'undefined') {
    return false;
  }
  return iosPasskeyBlock(navigator.userAgent) !== null;
}

/**
 * True when this Android device is too old to finish a new-account passkey.
 *
 * @returns Whether register must fail with `login.androidVersion`.
 */
function androidRegisterBlocked(): boolean {
  /* v8 ignore next 3 -- client hook: navigator exists whenever this runs */
  if (typeof navigator === 'undefined') {
    return false;
  }
  return androidPasskeyBlock(navigator.userAgent) !== null;
}

/** Where an old-iOS register stopped. `prf.absent` means create returned no extra key. */
type IosRegisterStop = 'create' | 'prf' | 'prf.absent';

/** Where an old-Android register stopped. `prf.absent` means create returned no extra key. */
type AndroidRegisterStop = 'create' | 'prf' | 'prf.absent';

/**
 * Keep the browser text that the diagnostic allowlist accepts.
 * Other characters become spaces so the whole message is not dropped.
 */
function diagnosticAllowlistText(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._: -]+/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, 120);
}

/**
 * Prefix plus browser text, always inside the 120-character allowlist.
 * A version token longer than the budget keeps the prefix only.
 *
 * @param prefix - OS label or register stop, already plain text.
 * @param extra - Allowlisted browser text. Empty keeps the prefix.
 */
function diagnosticWithPrefix(prefix: string, extra: string): string {
  const room = 120 - prefix.length - 2;
  /* v8 ignore next 3 -- components are capped at 8, and extra is non-empty */
  if (extra === '' || room < 1) {
    return diagnosticAllowlistText(prefix);
  }
  const clipped = extra.slice(0, room).trim();
  /* v8 ignore next 3 -- extra is already trimmed */
  if (clipped === '') {
    return diagnosticAllowlistText(prefix);
  }
  return diagnosticAllowlistText(`${prefix}. ${clipped}`);
}

/**
 * Version, stop, and the browser text, inside the 120-character allowlist.
 *
 * @param step - Which part of register stopped.
 * @param error - Ceremony rejection, when there is one.
 */
function iosDebugMessage(step: IosRegisterStop, error?: unknown): string {
  const block = iosPasskeyBlock(navigator.userAgent);
  /* v8 ignore next 3 -- caller already requires a parsed iOS version below 18 */
  if (block === null) {
    return `iOS unknown below 18 at ${step}`;
  }
  const prefix = `iOS ${block.installed} below ${block.required} at ${step}`;
  if (error === undefined) {
    return diagnosticAllowlistText(prefix);
  }
  const raw = diagnosticMessage(error);
  /* v8 ignore next 3 -- a DOMException message is a string */
  if (raw === undefined) {
    return diagnosticAllowlistText(prefix);
  }
  const safe = diagnosticAllowlistText(raw);
  if (safe === '') {
    return diagnosticAllowlistText(prefix);
  }
  return diagnosticWithPrefix(prefix, safe);
}

/**
 * Version, stop, and the browser text, inside the 120-character allowlist.
 *
 * @param step - Which part of register stopped.
 * @param error - Ceremony rejection, when there is one.
 */
function androidDebugMessage(step: AndroidRegisterStop, error?: unknown): string {
  const block = androidPasskeyBlock(navigator.userAgent);
  /* v8 ignore next 3 -- caller already requires a parsed Android version below 9 */
  if (block === null) {
    return `Android unknown below 9 at ${step}`;
  }
  const prefix = `Android ${block.installed} below ${block.required} at ${step}`;
  if (error === undefined) {
    return diagnosticAllowlistText(prefix);
  }
  const raw = diagnosticMessage(error);
  /* v8 ignore next 3 -- a DOMException message is a string */
  if (raw === undefined) {
    return diagnosticAllowlistText(prefix);
  }
  const safe = diagnosticAllowlistText(raw);
  if (safe === '') {
    return diagnosticAllowlistText(prefix);
  }
  return diagnosticWithPrefix(prefix, safe);
}

/**
 * Installed OS label for a failed login or register diagnostic, or null on
 * desktop and when the user agent has no version token.
 *
 * @returns `iOS 18.0` or `Android 14`, preferring iOS when both would match.
 */
function failedAttemptOsLabel(): string | null {
  /* v8 ignore next 3 -- client hook: navigator exists whenever this runs */
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return null;
  }
  const ios = iosInstalledVersion(navigator.userAgent);
  if (ios !== null) {
    return `iOS ${ios}`;
  }
  const android = androidInstalledVersion(navigator.userAgent);
  if (android !== null) {
    return `Android ${android}`;
  }
  return null;
}

/**
 * One diagnostic row for a login or register that did not finish.
 * An account id is optional. Its absence must not skip the row.
 * The server adds the user agent. No secret, challenge, or credential bytes.
 *
 * @param event - `client.passkey.login.fail` or `client.passkey.register.fail`.
 * @param stage - Which entry failed.
 * @param error - Browser or client error. Name and allowlisted text are kept.
 * @param ids - Challenge id and, when begin named one, the account id.
 */
function reportFailedAttempt(
  event: 'client.passkey.login.fail' | 'client.passkey.register.fail',
  stage: 'login' | 'authenticate' | 'register',
  error: unknown,
  ids?: { challengeId?: string; accountId?: string },
): void {
  const report: DiagnosticReport = { event, stage };
  const challengeId = ids?.challengeId;
  if (challengeId !== undefined) {
    report.challengeId = challengeId;
  }
  const accountId = ids?.accountId;
  if (accountId !== undefined) {
    report.accountId = accountId;
  }
  const name = diagnosticName(error);
  /* v8 ignore next 3 -- Error and DOMException have a string name */
  if (name !== undefined) {
    report.name = name;
  }
  const raw = diagnosticMessage(error);
  let safe = '';
  /* v8 ignore next 3 -- Error and DOMException have a string message */
  if (raw !== undefined) {
    safe = diagnosticAllowlistText(raw);
  }
  const osLabel = failedAttemptOsLabel();
  if (osLabel === null) {
    if (safe !== '') {
      report.message = safe;
    }
  } else if (
    safe === osLabel ||
    safe.startsWith(`${osLabel} `) ||
    safe.startsWith(`${osLabel}. `)
  ) {
    report.message = safe.slice(0, 120);
  } else if (safe === '') {
    report.message = diagnosticAllowlistText(osLabel);
  } else {
    report.message = diagnosticWithPrefix(osLabel, safe);
  }
  reportDiagnostic(report);
}

/**
 * Everything the allowlist can hold for an old-iOS register that did not finish.
 * The server adds the user agent. No secret, challenge, or credential bytes.
 */
function iosRegisterReport(
  step: IosRegisterStop,
  started: { challengeId: string; options: Record<string, unknown> },
  error?: unknown,
): DiagnosticReport {
  const report: DiagnosticReport = {
    event:
      step === 'prf.absent' ? 'client.passkey.register.prf' : 'client.passkey.register.ceremony',
    stage: 'register',
    prfPresent: false,
    message: iosDebugMessage(step, error),
    challengeId: started.challengeId,
  };
  const accountId = accountIdFromOptions(started.options);
  if (accountId !== undefined) {
    report.accountId = accountId;
  }
  if (error !== undefined) {
    const name = diagnosticName(error);
    /* v8 ignore next 3 -- a DOMException name is a string */
    if (name !== undefined) {
      report.name = name;
    }
  }
  return report;
}

/**
 * Everything the allowlist can hold for an old-Android register that did not finish.
 * The server adds the user agent. No secret, challenge, or credential bytes.
 */
function androidRegisterReport(
  step: AndroidRegisterStop,
  started: { challengeId: string; options: Record<string, unknown> },
  error?: unknown,
): DiagnosticReport {
  const report: DiagnosticReport = {
    event:
      step === 'prf.absent' ? 'client.passkey.register.prf' : 'client.passkey.register.ceremony',
    stage: 'register',
    prfPresent: false,
    message: androidDebugMessage(step, error),
    challengeId: started.challengeId,
  };
  const accountId = accountIdFromOptions(started.options);
  if (accountId !== undefined) {
    report.accountId = accountId;
  }
  if (error !== undefined) {
    const name = diagnosticName(error);
    /* v8 ignore next 3 -- a DOMException name is a string */
    if (name !== undefined) {
      report.name = name;
    }
  }
  return report;
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
 * Reads PRF bytes from a login assertion when the Breez API key is set and the
 * request used the app's own PRF salt. Reports presence only (never the bytes).
 * A missing, unreadable, or different salt and a throw or empty result count as absent.
 *
 * @param credential - WebAuthn assertion.
 * @param request - Browser request that produced the assertion.
 * @param challengeId - Challenge id from authenticate-begin.
 * @param stage - `login` or `authenticate` entry point.
 * @returns PRF first bytes when present, otherwise `undefined`.
 */
async function readLoginPrfFirst(
  credential: PublicKeyCredential,
  request: CredentialRequestOptions,
  challengeId: string,
  stage: 'login' | 'authenticate',
): Promise<Uint8Array | undefined> {
  if (getBreezApiKey() === null) {
    return undefined;
  }
  let prfFirst: Uint8Array | undefined;
  try {
    const requestSalt = request.publicKey?.extensions?.prf?.eval?.first;
    if (requestSalt !== undefined) {
      const expectedSalt = await prfEvalFirstSalt();
      const requestBytes = ArrayBuffer.isView(requestSalt)
        ? new Uint8Array(requestSalt.buffer, requestSalt.byteOffset, requestSalt.byteLength)
        : new Uint8Array(requestSalt);
      if (bytesToBase64Url(requestBytes) === bytesToBase64Url(expectedSalt)) {
        prfFirst = readPrfFirst(credential);
      }
    }
  } catch {
    prfFirst = undefined;
  }
  const present = prfFirst !== undefined && prfFirst.byteLength > 0;
  reportDiagnostic({
    event: 'client.passkey.login.prf',
    prfPresent: present,
    stage,
    challengeId,
  });
  return present ? prfFirst : undefined;
}

/**
 * Drives passkey register / authenticate. A run id ignores superseded clicks.
 * When the Breez API key is set, a successful ceremony may remember the
 * recovery phrase in tab memory from PRF output.
 *
 * @returns Status plus login, register, submitName, authenticate, retry, cancel, and error.
 */
export function usePasskeyLogin(): UsePasskeyLogin {
  const [status, setStatus] = useState<PasskeyStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<'invalid' | 'taken' | null>(null);
  const runIdRef = useRef(0);
  const lastKindRef = useRef<'register' | 'authenticate'>('authenticate');
  const entryKindRef = useRef<'login' | 'register' | 'authenticate'>('login');
  const lastViewKeyRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const choiceOfferedRef = useRef(false);
  const unknownOfferedRef = useRef(false);
  const nameOfferedRef = useRef(false);
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
    nameOfferedRef.current = false;
    setNameError(null);
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
      setNameError(null);
      setLastError(null);
      setStatus('starting');
      return { runId, controller };
    },
    [],
  );

  const completeRegistration = useCallback(
    async (
      runId: number,
      controller: AbortController,
      viewKey?: string,
      name?: string,
    ): Promise<void> => {
      guard(runId);
      let begin: Awaited<ReturnType<typeof startPasskeyRegistration>>;
      try {
        begin =
          viewKey !== undefined && viewKey !== ''
            ? await startPasskeyRegistration(viewKey)
            : await startPasskeyRegistration(undefined, name);
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
        if (isUserCancel(error) && iosRegisterBlocked()) {
          reportDiagnostic(iosRegisterReport('create', begin, error));
          throw new Error('login.iosVersion');
        }
        if (isUserCancel(error) && androidRegisterBlocked()) {
          reportDiagnostic(androidRegisterReport('create', begin, error));
          throw new Error('login.androidVersion');
        }
        const accountId = accountIdFromOptions(begin.options);
        if (isUserCancel(error)) {
          reportFailedAttempt('client.passkey.register.fail', 'register', error, {
            challengeId: begin.challengeId,
            ...(accountId === undefined ? {} : { accountId }),
          });
        } else {
          reportDiagnostic({
            event: 'client.passkey.register.ceremony',
            stage: 'register',
            name: diagnosticName(error),
            message: diagnosticMessage(error),
            challengeId: begin.challengeId,
            ...(accountId === undefined ? {} : { accountId }),
          });
        }
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
        if (isUserCancel(error) && iosRegisterBlocked()) {
          reportDiagnostic(iosRegisterReport('prf', begin, error));
          throw new Error('login.iosVersion');
        }
        if (isUserCancel(error) && androidRegisterBlocked()) {
          reportDiagnostic(androidRegisterReport('prf', begin, error));
          throw new Error('login.androidVersion');
        }
        const accountId = accountIdFromOptions(begin.options);
        if (isUserCancel(error)) {
          reportFailedAttempt('client.passkey.register.fail', 'register', error, {
            challengeId: begin.challengeId,
            ...(accountId === undefined ? {} : { accountId }),
          });
        } else {
          reportDiagnostic({
            event: 'client.passkey.register.ceremony',
            stage: 'register',
            name: diagnosticName(error),
            message: diagnosticMessage(error),
            challengeId: begin.challengeId,
            ...(accountId === undefined ? {} : { accountId }),
          });
        }
        throw error;
      }
      guard(runId);
      if (prfFirst === null) {
        if (iosRegisterBlocked()) {
          reportDiagnostic(iosRegisterReport('prf.absent', begin));
          throw new Error('login.iosVersion');
        }
        if (androidRegisterBlocked()) {
          reportDiagnostic(androidRegisterReport('prf.absent', begin));
          throw new Error('login.androidVersion');
        }
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
      // Start the derivation before the session is visible, so a wallet unlock
      // that reacts to the new session waits for it instead of prompting again.
      void rememberPhraseFromPrf({
        prfFirst,
        credentialId: publicKeyCredential.id,
        account: session.account,
        sessionToken: session.token,
      });
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
        reportFailedAttempt(
          'client.passkey.login.fail',
          entryKindRef.current === 'login' ? 'login' : 'authenticate',
          error,
          { challengeId: begin.challengeId },
        );
        throw error;
      }
      guard(runId);
      if (credential === null || credential.type !== 'public-key') {
        const error = new Error('Passkey assertion returned no credential');
        reportFailedAttempt(
          'client.passkey.login.fail',
          entryKindRef.current === 'login' ? 'login' : 'authenticate',
          error,
          { challengeId: begin.challengeId },
        );
        throw error;
      }
      const publicKeyCredential = credential as PublicKeyCredential;
      const prfFirst = await readLoginPrfFirst(
        publicKeyCredential,
        request,
        begin.challengeId,
        entryKindRef.current === 'login' ? 'login' : 'authenticate',
      );
      guard(runId);
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
      // Start the derivation before the session is visible, so a wallet unlock
      // that reacts to the new session waits for it instead of prompting again.
      void rememberPhraseFromPrf({
        prfFirst,
        credentialId: publicKeyCredential.id,
        account: session.account,
        sessionToken: session.token,
      });
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
        setNameError(null);
        setLastError(null);
        setStatus(
          nameOfferedRef.current
            ? 'name'
            : unknownOfferedRef.current
              ? 'unknown'
              : choiceOfferedRef.current
                ? 'choice'
                : 'idle',
        );
        return;
      }
      if (error instanceof Error && error.message === USERNAME_TAKEN) {
        setNameError('taken');
        setLastError(null);
        setStatus('name');
        return;
      }
      if (error instanceof Error && error.message === USERNAME_INVALID) {
        setNameError('invalid');
        setLastError(null);
        setStatus('name');
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
        reportFailedAttempt(
          'client.passkey.register.fail',
          'register',
          new Error('in-app browser'),
        );
        setStatus('unsupported');
        return;
      }
      entryKindRef.current = 'register';
      lastKindRef.current = 'register';
      lastViewKeyRef.current = viewKey;
      if (viewKey === undefined || viewKey === '') {
        nameOfferedRef.current = true;
        setNameError(null);
        setLastError(null);
        setStatus('name');
        return;
      }
      nameOfferedRef.current = false;
      const { runId, controller } = beginRun('register');
      void completeRegistration(runId, controller, viewKey).catch((error: unknown) => {
        finishWithError(runId, error);
      });
    },
    [beginRun, completeRegistration, finishWithError],
  );

  const submitName = useCallback(
    (raw: string): void => {
      if (isInAppBrowser()) {
        setStatus('unsupported');
        return;
      }
      const normalized = normalizeUsername(raw);
      if (normalized === null) {
        setNameError('invalid');
        setLastError(null);
        setStatus('name');
        return;
      }
      entryKindRef.current = 'register';
      lastViewKeyRef.current = undefined;
      nameOfferedRef.current = true;
      const { runId, controller } = beginRun('register');
      void completeRegistration(runId, controller, undefined, normalized).catch(
        (error: unknown) => {
          finishWithError(runId, error);
        },
      );
    },
    [beginRun, completeRegistration, finishWithError],
  );

  const authenticate = useCallback((): void => {
    clearSessionPhrase();
    if (isInAppBrowser()) {
      reportFailedAttempt('client.passkey.login.fail', 'authenticate', new Error('in-app browser'));
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
      reportFailedAttempt('client.passkey.login.fail', 'login', new Error('in-app browser'));
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
        if (unknownOfferedRef.current) {
          finishWithError(runId, error);
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
      nameOfferedRef.current = false;
    };
  }, []);

  return {
    status,
    login,
    register,
    submitName,
    authenticate,
    retry,
    cancel,
    error: status === 'error' ? lastError : null,
    nameError: status === 'name' ? nameError : null,
  };
}
