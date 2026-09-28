/** Tab-scoped in-app view stack. Not `localStorage`. */
const HISTORY_KEY = '21gifts.viewHistory';

const SLOT = '__giftsViewHistory';

const CAP = 50;

const SAFE_IN_APP_PATH = /^\/[A-Za-z0-9._~/-]*(?:\?[A-Za-z0-9._~%=&*+-]*)?$/;

type ViewHistoryMemory = { stack: string[]; cursor: number };

type ViewHistoryGlobal = typeof globalThis & { [SLOT]?: ViewHistoryMemory };

/**
 * True when `path` is a safe in-app href.
 *
 * Length, `//`, and `..` are checked explicitly: the regex alone would accept
 * them. `/wallet` is allowed. `/foo!` fails only the regex. The query allows
 * `+` and `*` because `URLSearchParams.toString()` emits a space as `+` and
 * leaves `*`.
 *
 * @param path - Candidate pathname, optionally with a query string.
 * @returns Whether the path may enter the view stack.
 */
function isSafeViewPath(path: string): boolean {
  if (path.length < 1 || path.length > 512) {
    return false;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false;
  }
  if (path.includes('\\') || path.includes('..') || path.includes('#') || /\s/.test(path)) {
    return false;
  }
  return SAFE_IN_APP_PATH.test(path);
}

/**
 * Slot already in memory, or the stored stack on first read. Does not invent
 * an empty stack: after {@link resetViewHistory} the slot stays missing until
 * a view is recorded.
 *
 * @returns The tab slot, or `null` when nothing is stored.
 */
function hydrateSlot(): ViewHistoryMemory | null {
  /* v8 ignore next 3 -- SSR must not retain a view stack */
  if (typeof window === 'undefined') {
    return null;
  }
  const g = globalThis as ViewHistoryGlobal;
  const existing = g[SLOT];
  if (existing) {
    return existing;
  }
  const stored = readStoredMemory();
  if (stored === null) {
    return null;
  }
  g[SLOT] = stored;
  return stored;
}

/**
 * Browser slot shared by every copy of this module. `null` during SSR so a
 * server render cannot keep one visitor's stack for the next request.
 *
 * @returns The tab slot, or `null` on the server.
 */
function browserSlot(): ViewHistoryMemory | null {
  const hydrated = hydrateSlot();
  if (hydrated) {
    return hydrated;
  }
  /* v8 ignore next 3 -- SSR must not retain a view stack */
  if (typeof window === 'undefined') {
    return null;
  }
  const created = { stack: [], cursor: 0 };
  (globalThis as ViewHistoryGlobal)[SLOT] = created;
  return created;
}

/**
 * Read the tab stack. A thrown storage read is an empty memory.
 *
 * @returns A stored stack, or `null`.
 */
function readStoredMemory(): ViewHistoryMemory | null {
  try {
    /* v8 ignore next 3 -- SSR has no sessionStorage */
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    const value = sessionStorage.getItem(HISTORY_KEY);
    if (value === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    const record = parsed as { stack?: unknown; cursor?: unknown };
    if (!Array.isArray(record.stack) || typeof record.cursor !== 'number') {
      return null;
    }
    const stack = record.stack.filter((entry): entry is string => typeof entry === 'string');
    if (!Number.isInteger(record.cursor) || record.cursor < 0 || record.cursor >= stack.length) {
      return stack.length === 0 ? { stack: [], cursor: 0 } : null;
    }
    return { stack, cursor: record.cursor };
  } catch {
    return null;
  }
}

/**
 * Persist the stack, or remove the key when the stack is empty after reset.
 *
 * @param memory - Stack to store, or `null` to clear.
 */
function writeStoredMemory(memory: ViewHistoryMemory | null): void {
  try {
    /* v8 ignore next 3 -- SSR has no sessionStorage */
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    if (memory === null) {
      sessionStorage.removeItem(HISTORY_KEY);
      return;
    }
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(memory));
  } catch {
    /* Private mode can reject storage; the global slot still holds the stack. */
  }
}

/**
 * Stamp `giftsView` on the current history entry without pushing.
 *
 * @param cursor - Index into the in-app stack.
 */
function stampGiftsView(cursor: number): void {
  /* v8 ignore next 3 -- SSR has no history */
  if (typeof window === 'undefined') {
    return;
  }
  window.history.replaceState({ ...window.history.state, giftsView: cursor }, '');
}

/**
 * Current `history.state.giftsView` when it is a number.
 *
 * @returns The stamped index, or `null`.
 */
function stampedIndex(): number | null {
  /* v8 ignore next 3 -- SSR has no history */
  if (typeof window === 'undefined') {
    return null;
  }
  const state = window.history.state as { giftsView?: unknown } | null;
  return typeof state?.giftsView === 'number' ? state.giftsView : null;
}

/**
 * Clear the in-app view stack used by the top-left back arrow.
 *
 * @returns void
 */
export function resetViewHistory(): void {
  const g = globalThis as ViewHistoryGlobal;
  delete g[SLOT];
  writeStoredMemory(null);
}

/**
 * Path this tab showed immediately before the current view, or `null`.
 *
 * @returns The previous in-app path, or `null` on the server / with no prior view.
 */
export function previousViewPath(): string | null {
  const slot = hydrateSlot();
  if (!slot) {
    return null;
  }
  if (slot.cursor < 1) {
    return null;
  }
  return slot.stack[slot.cursor - 1] ?? null;
}

/**
 * Record `path` as the current in-app view unless it is unsafe.
 *
 * Restores a stamped stack index on browser back/forward. A real link that
 * returns to an earlier path is a push, not a collapse. Caps the stack at 50.
 *
 * @param path - Candidate in-app path (pathname, optionally with query).
 * @returns void
 */
export function recordCurrentView(path: string): void {
  if (!isSafeViewPath(path)) {
    return;
  }
  const slot = browserSlot();
  /* v8 ignore next 3 -- SSR must not retain a view stack */
  if (!slot) {
    return;
  }
  const stamped = stampedIndex();
  if (
    stamped !== null &&
    Number.isInteger(stamped) &&
    stamped >= 0 &&
    stamped < slot.stack.length &&
    slot.stack[stamped] === path
  ) {
    slot.cursor = stamped;
    stampGiftsView(slot.cursor);
    writeStoredMemory({ stack: slot.stack, cursor: slot.cursor });
    return;
  }
  if (slot.stack[slot.cursor] === path) {
    if (stamped !== slot.cursor) {
      stampGiftsView(slot.cursor);
    }
    writeStoredMemory({ stack: slot.stack, cursor: slot.cursor });
    return;
  }
  const next = slot.stack.slice(0, slot.cursor + 1);
  next.push(path);
  if (next.length > CAP) {
    next.shift();
  }
  slot.stack = next;
  slot.cursor = next.length - 1;
  stampGiftsView(slot.cursor);
  writeStoredMemory({ stack: slot.stack, cursor: slot.cursor });
}

/**
 * Return to the previous in-app view, or open the forum when this tab has none.
 *
 * Does not call `history.back()` unless the current entry is stamped with an
 * in-app previous index, so an external referrer cannot take the visitor off
 * the site.
 *
 * @returns void
 */
export function goToPreviousView(): void {
  /* v8 ignore next 3 -- SSR has no location */
  if (typeof window === 'undefined') {
    return;
  }
  const prev = previousViewPath();
  if (prev === null) {
    window.location.assign('/welcome');
    return;
  }
  const stamped = stampedIndex();
  if (stamped !== null && stamped >= 1 && window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.assign(prev);
}
