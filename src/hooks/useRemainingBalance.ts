'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deletePreviousWallet, fetchPreviousWallets } from '@/lib/api';
import { relockHeldShares } from '@/lib/held-shares';
import {
  closePreviousWallet,
  openPreviousWallet,
  transferRemainingBalance,
} from '@/lib/remaining-balance';
import { peekSessionPhrase } from '@/lib/tab-phrase';
import { returnToView } from '@/lib/view-history';
import { visualPin } from '@/lib/visual-pin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Step of **Transfer remaining balance**
 * (`/settings/previous-wallets/[sparkPubkey]`):
 *
 * - `checking`: the account's previous wallets are read.
 * - `loadError`: they could not be read.
 * - `notFound`: this wallet is not one of them.
 * - `start`, `scan`, `type`: the wallet's old 12 words are read.
 * - `opening`: the wallet opens and reads its synced balance.
 * - `mismatch`: the words open another wallet.
 * - `walletError`: the wallet did not open.
 * - `balance`: its synced balance (0 offers the removal).
 * - `sending`: the balance is being moved.
 * - `error`: the balance did not move.
 * - `done`: moved; a synced read gave 0 (offers the removal).
 */
export type RemainingBalanceStep =
  | 'checking'
  | 'loadError'
  | 'notFound'
  | 'start'
  | 'scan'
  | 'type'
  | 'opening'
  | 'mismatch'
  | 'walletError'
  | 'balance'
  | 'sending'
  | 'error'
  | 'done';

/**
 * Where the removal of the previous wallet is: not asked (`idle`), the
 * confirm is open (`confirm`), the request runs (`busy`), or it failed
 * (`error`, the confirm stays open).
 */
export type PreviousWalletRemoval = 'idle' | 'confirm' | 'busy' | 'error';

/** What the previous wallet's page shows. */
export interface RemainingBalanceState {
  /** The step on screen. */
  step: RemainingBalanceStep;
  /** The wallet's synced balance in sats, once read. */
  balanceSats: number | null;
  /** Where the removal is. */
  removal: PreviousWalletRemoval;
}

/** State and actions of the previous wallet's page. */
export interface UseRemainingBalanceResult extends RemainingBalanceState {
  /** Whether the wallet may be removed: a synced read gave 0 (`balance` at 0, or `done`). */
  removable: boolean;
  /** **Try again** after `loadError`: reads the previous wallets again. */
  reload: () => void;
  /** **Scan two codes**. */
  scan: () => void;
  /** **Type my 12 words**. */
  type: () => void;
  /** The old 12 words were read: opens the wallet. */
  onWords: (words: string) => void;
  /** **Try again** after `mismatch` (back to the start) or `walletError` (opens again). */
  retryOpen: () => void;
  /** **Transfer** on `balance`, and **Try again** after `error`. */
  transfer: () => void;
  /** **Remove previous wallet**: opens the confirm. */
  askRemove: () => void;
  /** Closes the confirm. */
  cancelRemove: () => void;
  /** Confirms the removal. */
  confirmRemove: () => void;
  /** **Done** after a synced read of 0: returns to `/settings`. */
  leave: () => void;
  /** The top-left arrow: from the camera or the words field back to the start; `false` lets it leave. */
  back: () => boolean;
}

/** The first read, before anything shows. */
const CHECKING: RemainingBalanceState = { step: 'checking', balanceSats: null, removal: 'idle' };

/** Balance of the pinned screenshots that hold one: ₿21'000. */
const FIXTURE_BALANCE_SATS = 21_000;

/**
 * Playwright-only `?visual=` pins of `/settings/previous-wallets/[sparkPubkey]`:
 * the state each one opens on, without reading the list or opening a wallet.
 * Read through {@link visualPin}, so a deployed build ignores them.
 */
const PREVIOUS_WALLET_VISUAL_PINS: ReadonlyMap<string, RemainingBalanceState> = new Map<
  string,
  RemainingBalanceState
>([
  ['prev-opening', { step: 'opening', balanceSats: null, removal: 'idle' }],
  ['prev-mismatch', { step: 'mismatch', balanceSats: null, removal: 'idle' }],
  ['prev-balance', { step: 'balance', balanceSats: FIXTURE_BALANCE_SATS, removal: 'idle' }],
  ['prev-empty', { step: 'balance', balanceSats: 0, removal: 'idle' }],
  ['prev-sending', { step: 'sending', balanceSats: FIXTURE_BALANCE_SATS, removal: 'idle' }],
  ['prev-error', { step: 'error', balanceSats: FIXTURE_BALANCE_SATS, removal: 'idle' }],
  ['prev-done', { step: 'done', balanceSats: 0, removal: 'idle' }],
]);

/**
 * **Transfer remaining balance** for one previous wallet of the signed-in
 * account. It first reads the account's previous wallets: a wallet not among
 * them is `notFound`. The old 12 words (two codes of the account, or typed)
 * open the wallet ({@link openPreviousWallet}): words of another wallet are
 * `mismatch`, a wallet that does not open `walletError`, otherwise its synced
 * balance shows. **Transfer** moves it to the member's own wallet
 * ({@link transferRemainingBalance}, under the member's session, which a
 * failed send is reported with): `done` once a synced read gives 0, otherwise
 * `error`. Only with a synced read of 0 (`balance` at 0, or `done`)
 * can the wallet be removed from the account ({@link deletePreviousWallet},
 * behind a confirm; a wallet that an earlier press already removed counts as
 * removed), which closes it and returns to `/settings`. **Done** (after a
 * synced read of 0) returns there too. The words stay in component memory until the wallet
 * opened or the page closes; leaving the page closes the wallet
 * ({@link closePreviousWallet}). Words entered here also move the shares the
 * member keeps for others from these words to the open wallet's words in tab
 * memory ({@link relockHeldShares}, on its own, never holding up the page;
 * without words in tab memory, or for boxes that do not open with these
 * words, nothing moves). In a Playwright
 * build the `prev-…` pins open a fixture step.
 *
 * @param sparkPubkey - The previous wallet's identity key, from the address.
 * @returns The state and its actions.
 */
export function useRemainingBalance(sparkPubkey: string): UseRemainingBalanceResult {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const [state, setState] = useState<RemainingBalanceState>(CHECKING);
  const [reads, setReads] = useState(0);
  const wordsRef = useRef<string | null>(null);
  const runRef = useRef(0);
  const key = sparkPubkey.toLowerCase();

  useEffect(() => {
    const pin = visualPin();
    const pinned = pin === null ? undefined : PREVIOUS_WALLET_VISUAL_PINS.get(pin);
    if (pinned !== undefined) {
      setState(pinned);
      return;
    }
    if (session === null) {
      return;
    }
    let cancelled = false;
    fetchPreviousWallets(session).then(
      (wallets) => {
        if (!cancelled) {
          const listed = wallets.some((wallet) => wallet.sparkPubkey === key);
          setState({ ...CHECKING, step: listed ? 'start' : 'notFound' });
        }
      },
      () => {
        if (!cancelled) {
          setState({ ...CHECKING, step: 'loadError' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, reads, session]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      wordsRef.current = null;
      void closePreviousWallet();
    };
  }, []);

  const open = useCallback(
    (words: string): void => {
      const run = ++runRef.current;
      wordsRef.current = words;
      const holder = useAuthStore.getState().account;
      if (session !== null && holder !== null) {
        void relockHeldShares(session, holder.id, words, peekSessionPhrase());
      }
      setState({ step: 'opening', balanceSats: null, removal: 'idle' });
      void openPreviousWallet(words, key).then((result) => {
        if (runRef.current !== run) {
          return;
        }
        if (result === 'wallet') {
          setState({ step: 'walletError', balanceSats: null, removal: 'idle' });
          return;
        }
        wordsRef.current = null;
        setState(
          result === 'mismatch'
            ? { step: 'mismatch', balanceSats: null, removal: 'idle' }
            : { step: 'balance', balanceSats: result.balanceSats, removal: 'idle' },
        );
      });
    },
    [key, session],
  );

  const retryOpen = (): void => {
    const words = wordsRef.current;
    if (state.step === 'walletError' && words !== null) {
      open(words);
      return;
    }
    wordsRef.current = null;
    setState({ step: 'start', balanceSats: null, removal: 'idle' });
  };

  const transfer = (): void => {
    if (state.step !== 'balance' && state.step !== 'error') {
      return;
    }
    const run = ++runRef.current;
    const balanceSats = state.balanceSats;
    setState({ step: 'sending', balanceSats, removal: 'idle' });
    void transferRemainingBalance(session).then((result) => {
      if (runRef.current === run) {
        setState(
          result === 'sent'
            ? { step: 'done', balanceSats: 0, removal: 'idle' }
            : { step: 'error', balanceSats, removal: 'idle' },
        );
      }
    });
  };

  const removable = (state.step === 'balance' && state.balanceSats === 0) || state.step === 'done';

  const leave = useCallback((): void => {
    returnToView('/settings', router);
  }, [router]);

  const confirmRemove = (): void => {
    if (!removable || session === null || state.removal === 'busy') {
      return;
    }
    const run = runRef.current;
    setState({ ...state, removal: 'busy' });
    deletePreviousWallet(session, key).then(
      async () => {
        await closePreviousWallet();
        if (runRef.current === run) {
          leave();
        }
      },
      () => {
        if (runRef.current === run) {
          setState((current) => ({ ...current, removal: 'error' }));
        }
      },
    );
  };

  const back = (): boolean => {
    if (state.step !== 'scan' && state.step !== 'type') {
      return false;
    }
    setState({ step: 'start', balanceSats: null, removal: 'idle' });
    return true;
  };

  return {
    ...state,
    removable,
    reload: () => {
      setState(CHECKING);
      setReads((count) => count + 1);
    },
    scan: () => {
      setState({ step: 'scan', balanceSats: null, removal: 'idle' });
    },
    type: () => {
      setState({ step: 'type', balanceSats: null, removal: 'idle' });
    },
    onWords: open,
    retryOpen,
    transfer,
    askRemove: () => {
      if (removable) {
        setState((current) => ({ ...current, removal: 'confirm' }));
      }
    },
    cancelRemove: () => {
      setState((current) => ({ ...current, removal: 'idle' }));
    },
    confirmRemove,
    leave,
    back,
  };
}
