/** Fallback `/wallet` back target when nothing is remembered. */
export const WALLET_BACK_FALLBACK = '/welcome';

const SAFE_IN_APP_PATH = /^\/[A-Za-z0-9._~/-]*(?:\?[A-Za-z0-9._~%=&-]*)?$/;

/** In-memory return path. Never written to `localStorage` or `sessionStorage`. */
let rememberedPath: string | null = null;

/**
 * True when `path` is a safe in-app href and is not Wallet itself.
 *
 * Length, `//`, `..`, and `/wallet` are checked explicitly: the regex alone
 * would accept them. `/foo!` fails only the regex, so that test stays last.
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
 * Clear the remembered in-app path used by `/wallet` back.
 *
 * @returns void
 */
export function resetWalletReturn(): void {
  rememberedPath = null;
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
  rememberedPath = path;
}

/**
 * Remembered path, or `/welcome`.
 *
 * @returns The `/wallet` back href.
 */
export function walletBackHref(): string {
  return rememberedPath ?? WALLET_BACK_FALLBACK;
}
