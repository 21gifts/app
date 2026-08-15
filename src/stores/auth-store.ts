import { create } from 'zustand';
import type { Account } from '@/lib/api-types';
import { clearSession, saveSession } from '@/lib/session-storage';

/**
 * Shape of the authentication store.
 */
interface AuthState {
  /** The active session (bearer) token, or `null` when logged out. */
  session: string | null;
  /** The authenticated account, or `null` when logged out. */
  account: Account | null;
  /**
   * Records a completed login and persists the token to storage.
   *
   * @param session - The session (bearer) token.
   * @param account - The account it belongs to.
   */
  setAuth(session: string, account: Account): void;
  /**
   * Replaces the account while keeping the current session token.
   *
   * Used after a profile change (e.g. linking a Lightning Address) where the api
   * returns the updated account but the session is unchanged — the persisted
   * token is deliberately left untouched.
   *
   * @param account - The updated account.
   */
  setAccount(account: Account): void;
  /** Clears the session from state and from storage. */
  clearAuth(): void;
}

/**
 * Global authentication store.
 *
 * Deliberately starts with `session = null` and never reads `localStorage` at
 * module init: hydration happens explicitly on the client (see `LoginCard`) so
 * server and first client render agree and React does not warn.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  account: null,
  setAuth: (session, account) => {
    saveSession(session);
    set({ session, account });
  },
  setAccount: (account) => {
    set({ account });
  },
  clearAuth: () => {
    clearSession();
    set({ session: null, account: null });
  },
}));
