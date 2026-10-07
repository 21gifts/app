import { create } from 'zustand';
import type { Account } from '@/lib/api-types';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge } from '@/lib/app-badge';
import { clearSession, saveSession } from '@/lib/session-storage';
import { clearSessionPhrase } from '@/lib/tab-phrase';

/**
 * Shape of the authentication store.
 */
interface AuthState {
  /** The active session (bearer) token, or `null` when logged out. */
  session: string | null;
  /** The authenticated account, or `null` when logged out. */
  account: Account | null;
  /**
   * A stored, valid session token whose wallet is not open in this tab (after
   * a reload, in a new tab, or after a login that could not open the wallet).
   * Such a session counts as logged out: `session` and `account` stay `null`,
   * and signed-in screens show the login in place until a login opens the
   * wallet. The token stays in storage.
   */
  lockedSession: string | null;
  /**
   * True after a wrong-account 403 until the visitor retries login.
   * Survives {@link AuthState.clearAuth} so `/login` can show the hint.
   */
  wrongAccount: boolean;
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
   * Used after a profile change (e.g. saving a name or username) where the api
   * returns the updated account but the session is unchanged — the persisted
   * token is deliberately left untouched.
   *
   * @param account - The updated account.
   */
  setAccount(account: Account): void;
  /**
   * Holds a stored session back until its wallet is open (see
   * {@link AuthState.lockedSession}). Keeps the token in storage.
   *
   * @param session - The stored session token.
   */
  setLockedSession(session: string): void;
  /**
   * Moves the current session to {@link AuthState.lockedSession}: a login
   * whose wallet could not be opened does not count as signed in.
   */
  lockSession(): void;
  /** Clears the session from state and from storage, and the home-screen badge. */
  clearAuth(): void;
  /**
   * Sets whether the last refusal was the duplicate-account 403.
   *
   * @param value - `true` to show the dedicated `/login` hint.
   */
  setWrongAccount(value: boolean): void;
  /** Clears the dedicated wrong-account hint. Does not touch the session. */
  clearWrongAccount(): void;
}

/**
 * Global authentication store.
 *
 * Deliberately starts with `session = null` and never reads `localStorage` at
 * module init: hydration happens explicitly on the client via
 * `useHydrateSession` (`OnboardingGate`) so server and first client render
 * agree and React does not warn.
 */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  account: null,
  lockedSession: null,
  wrongAccount: false,
  setAuth: (session, account) => {
    saveSession(session);
    set({ session, account, lockedSession: null, wrongAccount: false });
  },
  setAccount: (account) => {
    set({ account });
  },
  setLockedSession: (session) => {
    set({ session: null, account: null, lockedSession: session });
  },
  lockSession: () => {
    set((state) =>
      state.session === null
        ? state
        : { session: null, account: null, lockedSession: state.session },
    );
  },
  clearAuth: () => {
    clearSessionPhrase();
    clearSession();
    bumpUnreadAppBadgeEpoch();
    setUnreadAppBadge(0);
    set({ session: null, account: null, lockedSession: null });
  },
  setWrongAccount: (value) => {
    set({ wrongAccount: value });
  },
  clearWrongAccount: () => {
    set({ wrongAccount: false });
  },
}));
