/** Event that asks the signed-in chrome to open the move-funds flow. */
export const MOVE_FUNDS_EVENT = '21gifts:move-funds';

/** Where a move-funds request came from: the Receive view's button or a `?move=1` link. */
export type MoveFundsSource = 'receive' | 'link';

/** Tab-scoped request and its source: it waits for a signed-in screen. Never the phrase. */
const PENDING_KEY = '21gifts.moveFunds';

/** In-memory copy, for a tab whose storage refuses writes. */
let pending: MoveFundsSource | null = null;

/**
 * Whether a stored value is a request source.
 *
 * @param value - Stored value.
 * @returns True for `receive` or `link`.
 */
function isSource(value: string | null): value is MoveFundsSource {
  return value === 'receive' || value === 'link';
}

/**
 * Asks for the move-funds flow: remembers the request and its source for this
 * tab (in `sessionStorage`, so it survives a sign-in, an onboarding redirect,
 * and a reload) and tells an open signed-in screen at once with
 * {@link MOVE_FUNDS_EVENT}. The flow takes it with {@link takeMoveFundsRequest}.
 *
 * @param source - `receive` for the Receive view's button, `link` for a `?move=1` link.
 */
export function requestMoveFunds(source: MoveFundsSource): void {
  pending = source;
  try {
    sessionStorage.setItem(PENDING_KEY, source);
  } catch {
    // The in-memory copy still carries it within this document.
  }
  window.dispatchEvent(new Event(MOVE_FUNDS_EVENT));
}

/**
 * Takes a waiting move-funds request, if there is one, and clears it.
 *
 * @returns The source of the request {@link requestMoveFunds} left, or `null`
 *   when there is none or it was taken already.
 */
export function takeMoveFundsRequest(): MoveFundsSource | null {
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    stored = null;
  }
  const source = pending ?? (isSource(stored) ? stored : null);
  pending = null;
  return source;
}
