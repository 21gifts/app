/** Fallback `/wallet` back target when nothing is remembered. */
export const WALLET_BACK_FALLBACK = '/welcome';

/** Tab-scoped path. Not `localStorage`, and never the recovery phrase. */
const RETURN_KEY = '21gifts.walletReturn';

const SLOT = '__giftsWalletReturn';

const SAFE_IN_APP_PATH = /^\/[A-Za-z0-9._~/-]*(?:\?[A-Za-z0-9._~%=&*+-]*)?$/;

type ReturnSlot = { path: string | null };

type ReturnGlobal = typeof globalThis & { [SLOT]?: ReturnSlot };

/**
 * True when `path` is a safe in-app href and is not Wallet itself.
 *
 * Length, `//`, `..`, and `/wallet` are checked explicitly: the regex alone
 * would accept them. `/foo!` fails only the regex. The query allows `+` and
 * `*` because `URLSearchParams.toString()` emits a space as `+` and leaves `*`.
 *
 * @param path - Candidate pathname, optionally with a query string.
 * @returns Whether {@link rememberWalletReturn} may store it.
 */
function isSafeWalletReturnPath(path: string): boolean {
  if (path.length < 1 || path.length > 512) {
    return false;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false;
  }
  if (path.includes('\\') || path.includes('..') || path.includes('#') || /\s/.test(path)) {
    return false;
  }
  if (path === '/wallet' || path.startsWith('/wallet?') || path.startsWith('/wallet/')) {
    return false;
  }
  return SAFE_IN_APP_PATH.test(path);
}

/**
 * Browser slot shared by every copy of this module. `null` during SSR so a
 * server render cannot keep one visitor's path for the next request.
 *
 * @returns The tab slot, or `null` on the server.
 */
function browserSlot(): ReturnSlot | null {
  /* v8 ignore next 3 -- SSR must not retain a return path */
  if (typeof window === 'undefined') {
    return null;
  }
  const g = globalThis as ReturnGlobal;
  const existing = g[SLOT];
  if (existing) {
    return existing;
  }
  const created: ReturnSlot = { path: readStoredPath() };
  g[SLOT] = created;
  return created;
}

/**
 * Read the tab path. A thrown storage read is an empty memory.
 *
 * @returns A safe path, or `null`.
 */
function readStoredPath(): string | null {
  /* v8 ignore next 3 -- SSR has no sessionStorage */
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const value = sessionStorage.getItem(RETURN_KEY);
    if (value !== null && isSafeWalletReturnPath(value)) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Persist `path`, or remove the key when `path` is `null`.
 *
 * @param path - Safe path, or `null` to clear.
 */
function writeStoredPath(path: string | null): void {
  /* v8 ignore next 3 -- SSR has no sessionStorage */
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    if (path === null) {
      sessionStorage.removeItem(RETURN_KEY);
      return;
    }
    sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* Private mode can reject storage; the global slot still holds the path. */
  }
}

/**
 * Clear the remembered in-app path used by `/wallet` back.
 *
 * @returns void
 */
export function resetWalletReturn(): void {
  const slot = browserSlot();
  /* v8 ignore next 3 -- SSR has no slot */
  if (!slot) {
    return;
  }
  slot.path = null;
  writeStoredPath(null);
}

/**
 * Remember `path` unless it is Wallet itself or not a safe in-app path.
 *
 * Leaves the previous memory unchanged when the candidate is rejected.
 *
 * @param path - Candidate in-app path (pathname, optionally with query).
 * @returns void
 */
export function rememberWalletReturn(path: string): void {
  if (!isSafeWalletReturnPath(path)) {
    return;
  }
  const slot = browserSlot();
  /* v8 ignore next 3 -- SSR must not retain a return path */
  if (!slot) {
    return;
  }
  slot.path = path;
  writeStoredPath(path);
}

/**
 * Remembered path, or `/welcome`.
 *
 * @returns The `/wallet` back href.
 */
export function walletBackHref(): string {
  return browserSlot()?.path ?? WALLET_BACK_FALLBACK;
}
