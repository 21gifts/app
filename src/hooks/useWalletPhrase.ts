'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reportDiagnostic } from '@/lib/diagnostics';
import { renewPasskey } from '@/lib/passkey-renew';
import {
  classifyWebAuthnError,
  mnemonicFromPrfFirst,
  obtainPrfFirstFromGet,
} from '@/lib/prf-mnemonic';
import { base64UrlToBytes } from '@/lib/webauthn-browser';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { rememberPhraseFromPrf, settlePhraseDerivations } from '@/lib/wallet/wallet-phrase';
import { useAuthStore } from '@/stores/auth-store';

export { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';

function diagnosticName(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return undefined;
  }
  const name = (error as { name: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

/** One wallet WebAuthn ceremony per tab, including across remounts. */
let ceremonyInFlight = false;

/**
 * Drop the module ceremony lock. Tests call this between cases.
 */
export function resetWalletCeremonyLock(): void {
  ceremonyInFlight = false;
}

/** Fixture words for `/wallet/phrase?visual=phrase` (not live PRF). */
export const WALLET_VISUAL_FIXTURE_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

/** Busy / idle / error for {@link useWalletPhrase}. */
export type WalletPhraseStatus = 'idle' | 'busy' | 'error';

/** User-facing error kinds for {@link useWalletPhrase}. */
export type WalletPhraseErrorKind = 'timeout' | 'prfUnsupported' | 'generic';

/** Which `/wallet` body to render. */
export type WalletPhraseView = 'activate' | 'reveal' | 'phrase';

/** Public surface of {@link useWalletPhrase}. */
export type UseWalletPhraseResult = {
  view: WalletPhraseView;
  status: WalletPhraseStatus;
  error: WalletPhraseErrorKind | null;
  words: string[];
  activate: () => Promise<void>;
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
  if (visualParam() === 'phrase') {
    return WALLET_VISUAL_FIXTURE_MNEMONIC;
  }
  return null;
}

function hasSeedPasskey(credentialId: string | null | undefined): boolean {
  return typeof credentialId === 'string' && credentialId !== '';
}

/**
 * Owns recovery-phrase add / show state for the signed-in `/wallet`
 * screen. Shows the 12 words in component state. When the unlocked wallet
 * already holds them in tab memory, shows those without a passkey prompt.
 * Otherwise derives them from WebAuthn PRF, and the same prompt unlocks the
 * wallet. Hiding the words does not lock the wallet.
 *
 * @returns View, status, words, and actions.
 */
export function useWalletPhrase(): UseWalletPhraseResult {
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [status, setStatus] = useState<WalletPhraseStatus>('idle');
  const [error, setError] = useState<WalletPhraseErrorKind | null>(() => {
    const visual = visualParam();
    if (visual === 'error') {
      return 'generic';
    }
    if (visual === 'timeout') {
      return 'timeout';
    }
    if (visual === 'prf-unsupported') {
      return 'prfUnsupported';
    }
    return null;
  });
  const [mnemonic, setMnemonic] = useState<string | null>(() => visualMnemonicOverride());

  useEffect(() => {
    const sync = (): void => {
      const visual = visualMnemonicOverride();
      if (visual) {
        setMnemonic(visual);
      }
    };
    window.addEventListener('21gifts:wallet-phrase', sync);
    return () => {
      window.removeEventListener('21gifts:wallet-phrase', sync);
    };
  }, []);

  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/).filter(Boolean) : []), [mnemonic]);
  const showingWords = words.length === 12;
  const inFlight = useRef(false);

  const view: WalletPhraseView = useMemo(() => {
    if (visualParam() === 'phrase') {
      return 'phrase';
    }
    if (showingWords) {
      return 'phrase';
    }
    if (hasSeedPasskey(account?.passkeyCredentialId)) {
      return 'reveal';
    }
    return 'activate';
  }, [account?.passkeyCredentialId, showingWords]);

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
    try {
      const result = await renewPasskey(token);
      if (result.outcome === 'cancelled') {
        setError(null);
        setStatus('idle');
        return;
      }
      if (result.outcome === 'stored') {
        if (isCurrentSession(token)) {
          setAccount(result.account);
        }
        setError(null);
        setStatus('idle');
        return;
      }
      if (result.outcome === 'failed') {
        setError(result.kind);
        setStatus('error');
        return;
      }
      let nextMnemonic: string;
      try {
        nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(result.prfFirst));
      } catch (deriveErr) {
        reportDiagnostic({
          event: 'client.passkey.seed.finish',
          stage: 'seed',
          name: diagnosticName(deriveErr),
        });
        if (useAuthStore.getState().session === token) {
          setAccount(result.account);
        }
        throw deriveErr;
      }
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      setAccount(result.account);
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
      // An unlocked wallet already holds the words in tab memory, also while
      // the login is still deriving them: show those without a second prompt.
      await settlePhraseDerivations();
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      const inMemory = peekSessionPhrase();
      if (inMemory !== null) {
        setMnemonic(inMemory);
        setStatus('idle');
        return;
      }
      const owner = useAuthStore.getState().account;
      const credentialId = owner?.passkeyCredentialId;
      if (owner === null || typeof credentialId !== 'string' || credentialId === '') {
        setError('generic');
        setStatus('error');
        return;
      }
      const prfFirst = await obtainPrfFirstFromGet(Uint8Array.from(base64UrlToBytes(credentialId)));
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      if (!prfFirst) {
        reportDiagnostic({
          event: 'client.passkey.seed.prf',
          prfPresent: false,
          stage: 'seed',
        });
        setError('prfUnsupported');
        setStatus('error');
        return;
      }
      reportDiagnostic({
        event: 'client.passkey.seed.prf',
        prfPresent: true,
        stage: 'seed',
      });
      const nextMnemonic = await mnemonicFromPrfFirst(Uint8Array.from(prfFirst));
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      // The same prompt opens the wallet, so the next payment does not ask again.
      void rememberPhraseFromPrf({
        prfFirst,
        credentialId,
        account: owner,
        sessionToken: token,
      });
      setMnemonic(nextMnemonic);
      setStatus('idle');
    } catch (err) {
      if (abandonStaleSession(token, setError, setStatus)) {
        return;
      }
      reportDiagnostic({
        event: 'client.passkey.seed.show',
        stage: 'seed',
        name: diagnosticName(err),
      });
      fail(err);
    } finally {
      inFlight.current = false;
      ceremonyInFlight = false;
    }
  }, [fail, session]);

  const hidePhrase = useCallback(() => {
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
    showPhrase,
    hidePhrase,
    retry,
  };
}
