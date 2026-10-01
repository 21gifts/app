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
  /** Marks the wallet as connecting and clears balance fields. */
  setConnecting(): void;
  /**
   * Marks the wallet ready with a balance and identity key.
   *
   * @param balanceSats - Confirmed balance in satoshis.
   * @param identityPubkey - Wallet identity public key.
   */
  setReady(balanceSats: number, identityPubkey: string): void;
  /** Marks the wallet as failed and clears balance fields. */
  setError(): void;
  /** Returns to the resting status and clears balance fields. */
  reset(): void;
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
  setConnecting: () => {
    set({ status: 'connecting', balanceSats: null, identityPubkey: null });
  },
  setReady: (balanceSats, identityPubkey) => {
    set({ status: 'ready', balanceSats, identityPubkey });
  },
  setError: () => {
    set({ status: 'error', balanceSats: null, identityPubkey: null });
  },
  reset: () => {
    set({ status: restingStatus(), balanceSats: null, identityPubkey: null });
  },
}));
