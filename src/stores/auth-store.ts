import { create } from 'zustand';
import type { Account } from '@/lib/api-types';
import { bumpUnreadAppBadgeEpoch, setUnreadAppBadge } from '@/lib/app-badge';
import { clearSession, saveSession } from '@/lib/session-storage';
import { clearSessionPhrase } from '@/lib/tab-phrase';

/**
 * Display name the login card greets a held-back session with.
 *
 * @param account - The account behind the held-back session, or `null`.
 * @returns Its name, else its username, else `null`.
 */
function lockedNameOf(account: Account | null): string | null {
  return account?.name ?? account?.username ?? null;
}

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
   * Display name of the account behind {@link AuthState.lockedSession} (its
   * name, else its username), so the login card can greet that member;
   * `null` when it has neither or no session is held back.
   */
  lockedName: string | null;
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
   * {@link AuthState.lockedSession}). Keeps the token in storage and clears
   * the home-screen badge, as for a signed-out visitor.
   *
   * @param session - The stored session token.
   * @param account - The account the token belongs to (its display name is kept).
   */
  setLockedSession(session: string, account: Account): void;
  /**
   * Moves the current session to {@link AuthState.lockedSession}: a login
   * whose wallet could not be opened does not count as signed in. Keeps the
   * account's display name for the login card and clears the home-screen
   * badge; does nothing without a current session.
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
  lockedName: null,
  wrongAccount: false,
  setAuth: (session, account) => {
    saveSession(session);
    set({ session, account, lockedSession: null, lockedName: null, wrongAccount: false });
  },
  setAccount: (account) => {
    set({ account });
  },
  setLockedSession: (session, account) => {
    bumpUnreadAppBadgeEpoch();
    setUnreadAppBadge(0);
    set({
      session: null,
      account: null,
      lockedSession: session,
      lockedName: lockedNameOf(account),
    });
  },
  lockSession: () => {
    const { session, account } = useAuthStore.getState();
    if (session === null) {
      return;
    }
    bumpUnreadAppBadgeEpoch();
    setUnreadAppBadge(0);
    set({
      session: null,
      account: null,
      lockedSession: session,
      lockedName: lockedNameOf(account),
    });
  },
  clearAuth: () => {
    clearSessionPhrase();
    clearSession();
    bumpUnreadAppBadgeEpoch();
    setUnreadAppBadge(0);
    set({ session: null, account: null, lockedSession: null, lockedName: null });
  },
  setWrongAccount: (value) => {
    set({ wrongAccount: value });
  },
  clearWrongAccount: () => {
    set({ wrongAccount: false });
  },
}));
