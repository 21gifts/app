/**
 * Persistence for the last time the visitor opened the No gifts yet filter.
 *
 * The ISO timestamp lives in `localStorage` so a returning visitor sees only
 * zero-sat notes created after that visit. Every accessor is guarded with
 * `typeof window === 'undefined'` so the module is safe to import during
 * server-side rendering, where no storage exists.
 */

/** `localStorage` key under which the last-visit ISO timestamp is stored. */
const STORAGE_KEY = '21gifts.forum-unpaid-seen';

/**
 * Reads the persisted No gifts yet last-visit timestamp.
 *
 * @returns The stored ISO string, or `null` when none is stored, the value is
 * empty/whitespace/`Date.parse` is not finite, or when running on the server
 * (no `window`).
 */
export function loadUnpaidSeenAt(): string | null {
  /* v8 ignore next 3 — SSR: no window */
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  const value = raw.trim();
  if (value === '') {
    return null;
  }
  if (!Number.isFinite(Date.parse(value))) {
    return null;
  }
  return value;
}

/**
 * Persists the No gifts yet last-visit timestamp, overwriting any previous
 * value.
 *
 * @param iso - ISO timestamp to store (`new Date().toISOString()`). A no-op
 * on the server.
 */
export function saveUnpaidSeenAt(iso: string): void {
  /* v8 ignore next 3 — SSR: no window */
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, iso);
}
