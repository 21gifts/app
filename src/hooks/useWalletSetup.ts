'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getE2eNow } from '@/lib/config';
import { peekSessionPhrase, SESSION_PHRASE_EVENT } from '@/lib/tab-phrase';
import { walletNeedsReload } from '@/lib/wallet/wallet-sdk';
import {
  runWalletSetup,
  walletSetupInFlight,
  type WalletSetupOutcome,
} from '@/lib/wallet/wallet-setup';

/**
 * What the setup dialog shows. `intro` explains the step and offers the
 * button that opens the passkey prompt, `progress` runs the steps, `error`
 * offers a retry, and `noPrf` says that this passkey cannot hold a wallet.
 */
export type WalletSetupView = 'intro' | 'progress' | 'error' | 'noPrf';

/** State and actions of the one-time wallet setup dialog. */
export interface UseWalletSetupResult {
  /** What the dialog shows. */
  view: WalletSetupView;
  /** Starts the setup (from the intro). */
  start: () => void;
  /** Starts the setup again after an error; reloads when the wallet must reload. */
  retry: () => void;
}

/**
 * Screenshot pin for the setup dialog (`?visual=setup-…`), honoured only in a
 * Playwright build (`getE2eNow()` set).
 *
 * @returns The pinned view, or `null` for the live flow.
 */
export function walletSetupPin(): WalletSetupView | null {
  /* v8 ignore next 3 -- SSR has no window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  switch (new URLSearchParams(window.location.search).get('visual')) {
    case 'setup-intro':
      return 'intro';
    case 'setup-progress':
      return 'progress';
    case 'setup-error':
      return 'error';
    case 'setup-no-prf':
      return 'noPrf';
    default:
      return null;
  }
}

/**
 * Drives the one-time wallet setup. Starts by itself (or joins the run in
 * progress after a remount) when the phrase is already in tab memory or a run
 * is in flight; otherwise waits for {@link UseWalletSetupResult.start}
 * so the passkey prompt follows a tap, and starts by itself when the phrase
 * arrives in tab memory while the intro is shown. A pinned view leaves the actions inert.
 *
 * @returns The current view and the start and retry actions.
 */
export function useWalletSetup(): UseWalletSetupResult {
  const [pinned] = useState(walletSetupPin);
  // Taken during the first render so a run that ends before the effect still
  // reports its outcome to this dialog.
  const [joined] = useState<Promise<WalletSetupOutcome> | null>(() =>
    pinned === null && walletSetupInFlight() ? runWalletSetup(() => undefined) : null,
  );
  const [view, setView] = useState<WalletSetupView>(() =>
    pinned === null && (joined !== null || peekSessionPhrase() !== null) ? 'progress' : 'intro',
  );
  const inFlight = useRef(false);

  const follow = useCallback((run: Promise<WalletSetupOutcome>): void => {
    inFlight.current = true;
    setView('progress');
    void run.then((outcome) => {
      inFlight.current = false;
      if (outcome === 'noPrf') {
        setView('noPrf');
      } else if (outcome === 'failed') {
        setView('error');
      } else if (outcome === 'cancelled' || outcome === 'superseded') {
        setView('intro');
      }
    });
  }, []);

  const start = useCallback((): void => {
    if (pinned !== null || inFlight.current) {
      return;
    }
    follow(runWalletSetup(() => undefined));
  }, [follow, pinned]);

  const retry = useCallback((): void => {
    if (pinned !== null) {
      return;
    }
    if (walletNeedsReload()) {
      window.location.reload();
      return;
    }
    start();
  }, [pinned, start]);

  useEffect(() => {
    if (joined !== null) {
      if (!inFlight.current) {
        follow(joined);
      }
      return;
    }
    if (pinned === null && peekSessionPhrase() !== null) {
      start();
    }
  }, [follow, joined, pinned, start]);

  useEffect(() => {
    if (pinned !== null || view !== 'intro') {
      return;
    }
    // The login may store the phrase just after this dialog mounted; start
    // then instead of asking for the passkey a second time.
    const onPhrase = (): void => {
      if (peekSessionPhrase() !== null) {
        start();
      }
    };
    window.addEventListener(SESSION_PHRASE_EVENT, onPhrase);
    return () => {
      window.removeEventListener(SESSION_PHRASE_EVENT, onPhrase);
    };
  }, [pinned, start, view]);

  return { view: pinned ?? view, start, retry };
}
