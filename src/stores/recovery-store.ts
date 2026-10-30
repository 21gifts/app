import { create } from 'zustand';

/**
 * Which parts of the move to the new passkey are done: the account moved to
 * the new passkey and wallet (`account`), the 21.gifts address moved
 * (`address`), the new passkey signed in (`signedIn`), and the balance moved
 * (`balance`).
 */
export interface RecoveryDone {
  /** The api stored the new passkey and wallet for the account. */
  account: boolean;
  /** The address moved to the new wallet, or the old wallet held none. */
  address: boolean;
  /** The new passkey signed in. */
  signedIn: boolean;
  /** The old wallet's balance moved to the new wallet. */
  balance: boolean;
}

/**
 * What `/recover` shows. The scan and type steps only name the input; the
 * codes, words, and their errors stay inside `OldWordsInput`.
 *
 * - `start`: the intro with **Scan two codes** and **Type my 12 words**.
 * - `scan` / `type`: the old words are read.
 * - `opening`: the old wallet opens and the account is looked up; `waiting`
 *   while the address service is asked again after a pause.
 * - `blocked`: logins are closed, or this build is outdated.
 * - `refused`: the old words lead to no account that can be recovered here.
 * - `retry`: the address service or the old wallet did not answer.
 * - `found`: the account to recover, before the new passkey is made.
 * - `transfer`: the move to this phone, one **Transfer** press at a time.
 * - `done`: the account is back; `balanceMissing` when the balance stayed.
 */
export type RecoveryView =
  | { step: 'start' }
  | { step: 'scan' }
  | { step: 'type' }
  | { step: 'opening'; waiting: boolean }
  | { step: 'blocked'; kind: 'closed' | 'outdated' }
  | { step: 'refused'; reason: 'not_found' | 'done' | 'operator' | 'otherAccount' | 'noWallet' }
  | { step: 'retry'; reason: 'unavailable' | 'wallet' }
  | {
      step: 'found';
      username: string;
      restart: boolean;
      error: 'cancelled' | 'prf' | 'timeout' | 'wallet' | null;
      busy: boolean;
    }
  | {
      step: 'transfer';
      done: RecoveryDone;
      busy: boolean;
      waiting: boolean;
      error: 'generic' | 'balance' | null;
    }
  | { step: 'done'; balanceMissing: boolean };

/** Shape of the recovery store. */
interface RecoveryState {
  /** The view on `/recover`. */
  view: RecoveryView;
  /**
   * Shows another view.
   *
   * @param view - The view to show.
   */
  setView(view: RecoveryView): void;
}

/**
 * What `/recover` shows, outside React so a later visit to the page in this
 * tab resumes where the recovery stopped. It holds the view only: the old and
 * new words, the PRF bytes, and the wallet connections stay in the recovery
 * flow module (`recovery-flow.ts`), in memory. Starts at `start`.
 */
export const useRecoveryStore = create<RecoveryState>((set) => ({
  view: { step: 'start' },
  setView: (view) => {
    set({ view });
  },
}));
