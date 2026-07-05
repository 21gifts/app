/**
 * Persistence for the LNURL-auth session token.
 *
 * The token lives in `localStorage` so a returning visitor stays logged in.
 * Every accessor is guarded with `typeof window === 'undefined'` so the module
 * is safe to import during server-side rendering, where no storage exists.
 */

/** `localStorage` key under which the session token is stored. */
const STORAGE_KEY = '21gifts.session';

/**
 * Reads the persisted session token.
 *
 * @returns The stored token, or `null` when none is stored or when running on
 * the server (no `window`).
 */
export function loadSession(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}

/**
 * Persists the session token, overwriting any previous value.
 *
 * @param token - The session token to store. A no-op on the server.
 */
export function saveSession(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, token);
}

/**
 * Removes the persisted session token, if any. A no-op on the server.
 */
export function clearSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
