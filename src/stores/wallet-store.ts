import { create } from 'zustand';
import { getBreezApiKey } from '@/lib/config';

/**
 * Lifecycle status of the in-app wallet.
 */
export type WalletStatus = 'disabled' | 'locked' | 'connecting' | 'ready' | 'error';

/**
 * Resting status: disabled when the Breez API key is unset, otherwise locked.
 *
 * @returns The status used for the initial state and after {@link WalletState.reset}.
 */
function restingStatus(): WalletStatus {
  return getBreezApiKey() === null ? 'disabled' : 'locked';
}

/**
 * Shape of the wallet store.
 */
interface WalletState {
  /** Current wallet lifecycle status. */
  status: WalletStatus;
  /** Confirmed balance in satoshis when ready, otherwise `null`. */
  balanceSats: number | null;
  /** Identity public key when ready, otherwise `null`. */
  identityPubkey: string | null;
  /**
   * Counts successful wallet reads (after connect and after each SDK sync).
   * The payment list reloads when it changes.
   */
  syncCount: number;
  /**
   * Session whose background wallet setup gave up after its retries, or
   * `null`. Money screens show the setup note while it is the current session.
   */
  setupFailedSession: string | null;
  /**
   * True while the wallet is at `error` and the wallet service opens it again
   * automatically (between and during its retries). False once the wallet is
   * ready, connecting, or reset.
   */
  retrying: boolean;
  /**
   * True while the wallet is `connecting` and the wallet code is still being
   * downloaded for the first time in this page (no deadline runs meanwhile).
   * False once it is loaded, and after a failed open or a reset.
   */
  downloading: boolean;
  /** Marks the wallet as connecting and clears balance fields. */
  setConnecting(): void;
  /**
   * Marks the wallet ready with a balance and identity key, and advances
   * `syncCount`.
   *
   * @param balanceSats - Confirmed balance in satoshis.
   * @param identityPubkey - Wallet identity public key.
   */
  setReady(balanceSats: number, identityPubkey: string): void;
  /** Marks the wallet as failed and clears balance fields. */
  setError(): void;
  /**
   * Records whether an automatic retry is on its way.
   *
   * @param retrying - Whether the wallet service is retrying.
   */
  setRetrying(retrying: boolean): void;
  /**
   * Records whether the wallet code is still being downloaded.
   *
   * @param downloading - Whether the download is running.
   */
  setDownloading(downloading: boolean): void;
  /** Returns to the resting status and clears balance fields. */
  reset(): void;
  /**
   * Records which session's background wallet setup gave up.
   *
   * @param session - That session token, or `null` to clear it.
   */
  setSetupFailedSession(session: string | null): void;
}

/**
 * Global in-app wallet store.
 *
 * Server-safe: does not touch `window`. The resting status depends on
 * {@link getBreezApiKey} at init and on every {@link WalletState.reset}.
 */
export const useWalletStore = create<WalletState>((set) => ({
  status: restingStatus(),
  balanceSats: null,
  identityPubkey: null,
  syncCount: 0,
  setupFailedSession: null,
  retrying: false,
  downloading: false,
  setConnecting: () => {
    set({ status: 'connecting', balanceSats: null, identityPubkey: null, retrying: false });
  },
  setReady: (balanceSats, identityPubkey) => {
    set((state) => ({
      status: 'ready',
      balanceSats,
      identityPubkey,
      syncCount: state.syncCount + 1,
      retrying: false,
      downloading: false,
    }));
  },
  setError: () => {
    set({ status: 'error', balanceSats: null, identityPubkey: null, downloading: false });
  },
  setRetrying: (retrying) => {
    set({ retrying });
  },
  setDownloading: (downloading) => {
    set({ downloading });
  },
  reset: () => {
    set({
      status: restingStatus(),
      balanceSats: null,
      identityPubkey: null,
      retrying: false,
      downloading: false,
    });
  },
  setSetupFailedSession: (session) => {
    set({ setupFailedSession: session });
  },
}));
