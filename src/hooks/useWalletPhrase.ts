'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { finishPasskeyReplace, postWalletBackupSeen, startPasskeyReplace } from '@/lib/api';
import { nextOnboardingPath } from '@/lib/onboarding';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirst,
  obtainPrfFirstFromGet,
} from '@/lib/prf-mnemonic';
import { creationOptionsFromJSON, credentialToJSON } from '@/lib/webauthn-browser';
import { useAuthStore } from '@/stores/auth-store';

/** In-tab recovery phrase. Never written to localStorage or sent to the API. */
let sessionMnemonic: string | null = null;

/** Fixture words for visual `/wallet:phrase` and `/wallet:confirm` (not live PRF). */
export const WALLET_VISUAL_FIXTURE_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

/**
 * Store a derived recovery phrase in tab memory so `/wallet` can show it
 * after register or replace without persisting it.
 *
 * @param mnemonic - Space-separated BIP-39 words.
 */
export function rememberSessionPhrase(mnemonic: string): void {
  sessionMnemonic = mnemonic;
}

/**
 * Current in-memory recovery phrase, or `null`.
 *
 * @returns The phrase, or `null`.
 */
export function peekSessionPhrase(): string | null {
  return sessionMnemonic;
}

/**
 * Drop the in-memory recovery phrase.
 */
export function clearSessionPhrase(): void {
  sessionMnemonic = null;
}

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
  const [error, setError] = useState<WalletPhraseErrorKind | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(
    () => visualMnemonicOverride() ?? peekSessionPhrase(),
  );

  const setupWallet = account?.setup === 'wallet';
  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/).filter(Boolean) : []), [mnemonic]);
  const showingWords = words.length === 12;

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
    if (session === null) {
      return;
    }
    setStatus('busy');
    setError(null);
    try {
      const begin = await startPasskeyReplace(session);
      const options = mergePrfExtension(creationOptionsFromJSON(begin.options));
      const credential = (await navigator.credentials.create({
        publicKey: options,
      })) as PublicKeyCredential | null;
      if (!credential) {
        setStatus('idle');
        return;
      }
      const prfFirst = await obtainPrfFirst(credential);
      if (!prfFirst) {
        setError('prfUnsupported');
        setStatus('error');
        return;
      }
      const nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      const nextAccount = await finishPasskeyReplace(
        session,
        begin.challengeId,
        credentialToJSON(credential),
      );
      setAccount(nextAccount);
      rememberSessionPhrase(nextMnemonic);
      setMnemonic(nextMnemonic);
      setStatus('idle');
    } catch (err) {
      fail(err);
    }
  }, [fail, session, setAccount]);

  const showPhrase = useCallback(async () => {
    if (session === null) {
      return;
    }
    setStatus('busy');
    setError(null);
    try {
      const prfFirst = await obtainPrfFirstFromGet();
      if (!prfFirst) {
        setError('prfUnsupported');
        setStatus('error');
        return;
      }
      const nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      rememberSessionPhrase(nextMnemonic);
      setMnemonic(nextMnemonic);
      setStatus('idle');
    } catch (err) {
      fail(err);
    }
  }, [fail, session]);

  const confirmSaved = useCallback(async () => {
    if (session === null) {
      return;
    }
    setStatus('busy');
    setError(null);
    try {
      const nextAccount = await postWalletBackupSeen(session);
      setAccount(nextAccount);
      clearSessionPhrase();
      setMnemonic(null);
      setStatus('idle');
      router.push(nextOnboardingPath(nextAccount));
    } catch (err) {
      fail(err);
    }
  }, [fail, router, session, setAccount]);

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
