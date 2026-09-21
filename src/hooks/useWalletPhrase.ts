'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { finishPasskeyReplace, postWalletBackupSeen, startPasskeyReplace } from '@/lib/api';
import { nextOnboardingPath } from '@/lib/onboarding';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirst,
  obtainPrfFirstFromGet,
} from '@/lib/prf-mnemonic';
import { creationOptionsFromJSON, credentialToJSON } from '@/lib/webauthn-browser';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { useAuthStore } from '@/stores/auth-store';

export { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';

/** Fixture words for visual `/wallet:phrase` and `/wallet:confirm` (not live PRF). */
export const WALLET_VISUAL_FIXTURE_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

/** Busy / idle / error for {@link useWalletPhrase}. */
export type WalletPhraseStatus = 'idle' | 'busy' | 'error';

/** User-facing error kinds for {@link useWalletPhrase}. */
export type WalletPhraseErrorKind = 'timeout' | 'prfUnsupported' | 'generic';

/** Which `/wallet` body to render. */
export type WalletPhraseView = 'activate' | 'confirm' | 'reveal' | 'phrase';

/** Public surface of {@link useWalletPhrase}. */
export type UseWalletPhraseResult = {
  view: WalletPhraseView;
  status: WalletPhraseStatus;
  error: WalletPhraseErrorKind | null;
  words: string[];
  activate: () => Promise<void>;
  confirmSaved: () => Promise<void>;
  showPhrase: () => Promise<void>;
  hidePhrase: () => void;
  retry: () => void;
};

function isCurrentSession(token: string): boolean {
  return useAuthStore.getState().session === token;
}

function abandonStaleSession(
  token: string,
  setError: (value: WalletPhraseErrorKind | null) => void,
  setStatus: (value: WalletPhraseStatus) => void,
): boolean {
  if (isCurrentSession(token)) {
    return false;
  }
  setError(null);
  setStatus('idle');
  return true;
}

function visualParam(): string | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  return new URLSearchParams(window.location.search).get('visual');
}

function visualMnemonicOverride(): string | null {
  const visual = visualParam();
  if (visual === 'phrase' || visual === 'confirm') {
    return WALLET_VISUAL_FIXTURE_MNEMONIC;
  }
  return null;
}

function mergePrfExtension(
  options: PublicKeyCredentialCreationOptions,
): PublicKeyCredentialCreationOptions {
  const extensions = {
    ...(options.extensions ?? {}),
    prf: (options.extensions as { prf?: object } | undefined)?.prf ?? {},
  };
  return { ...options, extensions };
}

/**
 * Owns recovery-phrase show / activate / confirm state for the signed-in
 * `/wallet` screen. Derives the 12 words from WebAuthn PRF in memory only.
 *
 * @returns View, status, words, and actions.
 */
export function useWalletPhrase(): UseWalletPhraseResult {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const router = useRouter();
  const [status, setStatus] = useState<WalletPhraseStatus>('idle');
  const [error, setError] = useState<WalletPhraseErrorKind | null>(() => {
    const visual = visualParam();
    if (visual === 'error') {
      return 'generic';
    }
    if (visual === 'prf-unsupported') {
      return 'prfUnsupported';
    }
    return null;
  });
  const [mnemonic, setMnemonic] = useState<string | null>(
    () => visualMnemonicOverride() ?? peekSessionPhrase(),
  );

  const setupWallet = account?.setup === 'wallet';
  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/).filter(Boolean) : []), [mnemonic]);
  const showingWords = words.length === 12;
  const inFlight = useRef(false);

  const view: WalletPhraseView = useMemo(() => {
    const visual = visualParam();
    if (visual === 'confirm' || setupWallet) {
      return 'confirm';
    }
    if (visual === 'phrase' || showingWords) {
      return 'phrase';
    }
    if (account?.walletRequired !== true && (account?.walletBackupSeenAt ?? null) === null) {
      return 'activate';
    }
    return 'reveal';
  }, [account?.walletBackupSeenAt, account?.walletRequired, setupWallet, showingWords]);

  const fail = useCallback((err: unknown) => {
    const kind = classifyWebAuthnError(err);
    if (kind === 'cancel') {
      setError(null);
      setStatus('idle');
      return;
    }
    const message = err instanceof Error ? err.message : '';
    if (message === 'wallet.prfUnsupported' || message === 'prfUnsupported') {
      setError('prfUnsupported');
      setStatus('error');
      return;
    }
    setError(kind === 'timeout' ? 'timeout' : 'generic');
    setStatus('error');
  }, []);

  const activate = useCallback(async () => {
    if (session === null || inFlight.current) {
      return;
    }
    const token = session;
    inFlight.current = true;
    setStatus('busy');
    setError(null);
    try {
      const begin = await startPasskeyReplace(token);
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      const options = mergePrfExtension(creationOptionsFromJSON(begin.options));
      const credential = (await navigator.credentials.create({
        publicKey: options,
      })) as PublicKeyCredential | null;
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      if (!credential) {
        setStatus('idle');
        return;
      }
      const prfFirst = await obtainPrfFirst(credential);
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      if (!prfFirst) {
        setError('prfUnsupported');
        setStatus('error');
        return;
      }
      const nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      let nextAccount = await finishPasskeyReplace(
        token,
        begin.challengeId,
        credentialToJSON(credential),
      );
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      if (nextAccount.walletRequired !== true) {
        nextAccount = await postWalletBackupSeen(token);
        if (abandonStaleSession(token, setError, setStatus)) {
          return;
        }
      }
      setAccount(nextAccount);
      rememberSessionPhrase(nextMnemonic);
      setMnemonic(nextMnemonic);
      setStatus('idle');
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      fail(err);
    } finally {
      inFlight.current = false;
    }
  }, [fail, session, setAccount]);

  const showPhrase = useCallback(async () => {
    if (session === null || inFlight.current) {
      return;
    }
    const token = session;
    inFlight.current = true;
    setStatus('busy');
    setError(null);
    try {
      const prfFirst = await obtainPrfFirstFromGet();
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      if (!prfFirst) {
        setError('prfUnsupported');
        setStatus('error');
        return;
      }
      const nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      rememberSessionPhrase(nextMnemonic);
      setMnemonic(nextMnemonic);
      setStatus('idle');
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      fail(err);
    } finally {
      inFlight.current = false;
    }
  }, [fail, session]);

  const confirmSaved = useCallback(async () => {
    if (session === null || inFlight.current) {
      return;
    }
    if (visualParam() !== null && mnemonic === WALLET_VISUAL_FIXTURE_MNEMONIC) {
      return;
    }
    const token = session;
    inFlight.current = true;
    setStatus('busy');
    setError(null);
    try {
      const nextAccount = await postWalletBackupSeen(token);
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      setAccount(nextAccount);
      clearSessionPhrase();
      setMnemonic(null);
      setStatus('idle');
      router.push(nextOnboardingPath(nextAccount));
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      fail(err);
    } finally {
      inFlight.current = false;
    }
  }, [fail, mnemonic, router, session, setAccount]);

  const hidePhrase = useCallback(() => {
    clearSessionPhrase();
    setMnemonic(null);
    setError(null);
    setStatus('idle');
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  return {
    view,
    status,
    error,
    words,
    activate,
    confirmSaved,
    showPhrase,
    hidePhrase,
    retry,
  };
}
