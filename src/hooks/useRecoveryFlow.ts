'use client';

import { useCallback, useEffect } from 'react';
import {
  createNewPasskey,
  finishWithoutBalance,
  openAndBegin,
  rememberOldWords,
  resetRecovery,
  resumeRecovery,
  transfer,
} from '@/lib/recovery-flow';
import { visualPin } from '@/lib/visual-pin';
import { useRecoveryStore, type RecoveryDone, type RecoveryView } from '@/stores/recovery-store';

/** State and actions of `/recover`. */
export interface UseRecoveryFlowResult {
  /** The view on screen. */
  view: RecoveryView;
  /** **Scan two codes**: opens the camera. */
  scan: () => void;
  /** **Type my 12 words**: opens the words field. */
  type: () => void;
  /** The old 12 words were read: starts the recovery with them. */
  onWords: (words: string, ownerAccountId: string | null) => void;
  /** **Try again** on `retry`: opens the old wallet and looks the account up again. */
  retry: () => void;
  /** **Try again** on `blocked` `closed`: resumes the recovery where closed logins stopped it. */
  resume: () => void;
  /** **Create new passkey** on `found`. */
  createPasskey: () => void;
  /** **Transfer** on `transfer`. */
  transfer: () => void;
  /** **Move the balance later** after the balance error. */
  balanceLater: () => void;
  /** **Start over**: drops the recovery and shows the start. */
  startOver: () => void;
  /** The top-left arrow: from the camera or the words field back to the start; `false` lets it leave. */
  back: () => boolean;
}

/** Nothing of the move done yet. */
const NOTHING_DONE: RecoveryDone = {
  account: false,
  address: false,
  signedIn: false,
  balance: false,
};

/** The account of the pinned screenshots. */
const FIXTURE_USERNAME = 'ada';

/** A pinned `found` view. */
const FOUND: Extract<RecoveryView, { step: 'found' }> = {
  step: 'found',
  username: FIXTURE_USERNAME,
  restart: false,
  error: null,
  busy: false,
};

/** A pinned `transfer` view with nothing done. */
const TRANSFER: Extract<RecoveryView, { step: 'transfer' }> = {
  step: 'transfer',
  done: NOTHING_DONE,
  busy: false,
  waiting: false,
  error: null,
};

/**
 * Playwright-only `?visual=` pins of `/recover`: the view each one opens on,
 * for the account `@ada`. Read through {@link visualPin}, so a deployed build
 * ignores them.
 */
const RECOVERY_VISUAL_PINS: ReadonlyMap<string, RecoveryView> = new Map<string, RecoveryView>([
  ['recover-opening', { step: 'opening', waiting: false }],
  ['recover-opening-wait', { step: 'opening', waiting: true }],
  ['recover-blocked-closed', { step: 'blocked', kind: 'closed' }],
  ['recover-blocked-outdated', { step: 'blocked', kind: 'outdated' }],
  ['recover-not-found', { step: 'refused', reason: 'not_found' }],
  ['recover-done', { step: 'refused', reason: 'done' }],
  ['recover-operator', { step: 'refused', reason: 'operator' }],
  ['recover-other-account', { step: 'refused', reason: 'otherAccount' }],
  ['recover-unavailable', { step: 'retry', reason: 'unavailable' }],
  ['recover-wallet-error', { step: 'retry', reason: 'wallet' }],
  ['recover-found', FOUND],
  ['recover-found-busy', { ...FOUND, busy: true }],
  ['recover-restart', { ...FOUND, restart: true }],
  ['recover-cancelled', { ...FOUND, error: 'cancelled' }],
  ['recover-timeout', { ...FOUND, error: 'timeout' }],
  ['recover-prf', { ...FOUND, error: 'prf' }],
  ['recover-new-wallet-error', { ...FOUND, error: 'wallet' }],
  ['recover-transfer', TRANSFER],
  ['recover-transfer-busy', { ...TRANSFER, busy: true }],
  [
    'recover-transfer-progress',
    {
      ...TRANSFER,
      done: { ...NOTHING_DONE, account: true, address: true },
      busy: true,
      waiting: true,
    },
  ],
  [
    'recover-transfer-error',
    { ...TRANSFER, done: { ...NOTHING_DONE, account: true }, error: 'generic' },
  ],
  [
    'recover-balance-error',
    {
      ...TRANSFER,
      done: { ...NOTHING_DONE, account: true, address: true, signedIn: true },
      error: 'balance',
    },
  ],
  ['recover-complete', { step: 'done', balanceMissing: false }],
  ['recover-complete-missing', { step: 'done', balanceMissing: true }],
]);

/**
 * `/recover` for a member who lost the passkey: the view of the recovery in
 * this tab (`useRecoveryStore`, which outlives the page, so a later visit
 * resumes) and the presses that drive the recovery flow (`recovery-flow.ts`).
 * Leaving the page on the done step drops the recovery, so the next visit
 * starts over. In a Playwright build the `recover-…` pins open a fixture view.
 *
 * @returns The view and its actions.
 */
export function useRecoveryFlow(): UseRecoveryFlowResult {
  const view = useRecoveryStore((state) => state.view);
  const setView = useRecoveryStore((state) => state.setView);

  useEffect(() => {
    const pin = visualPin();
    const pinned = pin === null ? undefined : RECOVERY_VISUAL_PINS.get(pin);
    if (pinned !== undefined) {
      setView(pinned);
    }
    return () => {
      if (useRecoveryStore.getState().view.step === 'done') {
        void resetRecovery();
      }
    };
  }, [setView]);

  const scan = useCallback((): void => {
    setView({ step: 'scan' });
  }, [setView]);

  const type = useCallback((): void => {
    setView({ step: 'type' });
  }, [setView]);

  const onWords = useCallback((words: string, ownerAccountId: string | null): void => {
    void rememberOldWords(words, ownerAccountId);
  }, []);

  const back = (): boolean => {
    if (view.step !== 'scan' && view.step !== 'type') {
      return false;
    }
    setView({ step: 'start' });
    return true;
  };

  return {
    view,
    scan,
    type,
    onWords,
    retry: () => {
      void openAndBegin();
    },
    resume: () => {
      void resumeRecovery();
    },
    createPasskey: () => {
      void createNewPasskey();
    },
    transfer: () => {
      void transfer();
    },
    balanceLater: () => {
      void finishWithoutBalance();
    },
    startOver: () => {
      void resetRecovery();
    },
    back,
  };
}
