'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { finishPasskeyReplace, postWalletBackupSeen, startPasskeyReplace } from '@/lib/api';
import { nextOnboardingPath } from '@/lib/onboarding';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirst,
  obtainPrfFirstFromGet,
  prfEvalFirstSalt,
} from '@/lib/prf-mnemonic';
import {
  base64UrlToBytes,
  creationOptionsFromJSON,
  credentialToJSON,
} from '@/lib/webauthn-browser';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { useAuthStore } from '@/stores/auth-store';

export { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';

/** One wallet WebAuthn ceremony per tab, including across remounts. */
let ceremonyInFlight = false;

/**
 * Drop the module ceremony lock. Tests call this between cases.
 */
export function resetWalletCeremonyLock(): void {
  ceremonyInFlight = false;
}

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
  ownedMnemonic?: string | null,
): boolean {
  if (isCurrentSession(token)) {
    return false;
  }
  // Logout/login already dropped the previous tab phrase. Clear only when
  // this ceremony still owns the RAM words so a newer session's mnemonic
  // survives.
  if (ownedMnemonic && peekSessionPhrase() === ownedMnemonic) {
    clearSessionPhrase();
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

async function mergePrfExtension(
  options: PublicKeyCredentialCreationOptions,
): Promise<PublicKeyCredentialCreationOptions> {
  const salt = await prfEvalFirstSalt();
  const first = new Uint8Array(salt.byteLength);
  first.set(salt);
  const extensions = {
    ...(options.extensions ?? {}),
    prf: { eval: { first } },
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

  useEffect(() => {
    const sync = (): void => {
      setMnemonic(visualMnemonicOverride() ?? peekSessionPhrase());
    };
    window.addEventListener('21gifts:wallet-phrase', sync);
    sync();
    return () => {
      window.removeEventListener('21gifts:wallet-phrase', sync);
    };
  }, []);

  const setupWallet = account?.setup === 'wallet';
  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/).filter(Boolean) : []), [mnemonic]);
  const showingWords = words.length === 12;
  const inFlight = useRef(false);

  const view: WalletPhraseView = useMemo(() => {
    const visual = visualParam();
    if (visual === 'confirm' || setupWallet) {
      return 'confirm';
    }
    if (visual === 'phrase') {
      return 'phrase';
    }
    if (showingWords && (account?.walletBackupSeenAt ?? null) === null) {
      return 'confirm';
    }
    if (showingWords) {
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
    if (session === null || inFlight.current || ceremonyInFlight) {
      return;
    }
    const token = session;
    inFlight.current = true;
    ceremonyInFlight = true;
    setStatus('busy');
    setError(null);
    let storedMnemonic: string | undefined;
    try {
      const begin = await startPasskeyReplace(token);
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      const options = await mergePrfExtension(creationOptionsFromJSON(begin.options));
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
      nextAccount = {
        ...nextAccount,
        passkeyCredentialId: credential.id,
      };
      setAccount(nextAccount);
      rememberSessionPhrase(nextMnemonic);
      storedMnemonic = nextMnemonic;
      setMnemonic(nextMnemonic);
      if (nextAccount.walletRequired !== true) {
        try {
          nextAccount = await postWalletBackupSeen(token);
          if (abandonStaleSession(token, setError, setStatus, storedMnemonic)) {
            return;
          }
          setAccount({
            ...nextAccount,
            passkeyCredentialId: credential.id,
          });
        } catch (err) {
          if (abandonStaleSession(token, setError, setStatus, storedMnemonic)) {
            return;
          }
          fail(err);
          setStatus('idle');
          return;
        }
      }
      setStatus('idle');
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus, storedMnemonic)) {
        return;
      }
      fail(err);
    } finally {
      inFlight.current = false;
      ceremonyInFlight = false;
    }
  }, [fail, session, setAccount]);

  const showPhrase = useCallback(async () => {
    if (session === null || inFlight.current || ceremonyInFlight) {
      return;
    }
    const token = session;
    inFlight.current = true;
    ceremonyInFlight = true;
    setStatus('busy');
    setError(null);
    try {
      const credentialId = useAuthStore.getState().account?.passkeyCredentialId;
      if (credentialId === undefined || credentialId === null || credentialId === '') {
        setError('generic');
        setStatus('error');
        return;
      }
      const prfFirst = await obtainPrfFirstFromGet(Uint8Array.from(base64UrlToBytes(credentialId)));
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
      ceremonyInFlight = false;
    }
  }, [fail, session]);

  const confirmSaved = useCallback(async () => {
    if (session === null || inFlight.current || ceremonyInFlight) {
      return;
    }
    if (visualParam() !== null && mnemonic === WALLET_VISUAL_FIXTURE_MNEMONIC) {
      return;
    }
    const token = session;
    inFlight.current = true;
    ceremonyInFlight = true;
    setStatus('busy');
    setError(null);
    try {
      const nextAccount = await postWalletBackupSeen(token);
      if (abandonStaleSession(token, setError, setStatus, mnemonic)) {
        return;
      }
      setAccount({
        ...nextAccount,
        passkeyCredentialId:
          nextAccount.passkeyCredentialId ??
          useAuthStore.getState().account?.passkeyCredentialId ??
          null,
      });
      clearSessionPhrase();
      setMnemonic(null);
      setStatus('idle');
      router.push(nextOnboardingPath(nextAccount));
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus, mnemonic)) {
        return;
      }
      fail(err);
    } finally {
      inFlight.current = false;
      ceremonyInFlight = false;
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
