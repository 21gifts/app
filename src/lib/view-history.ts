/** Tab-scoped in-app view stack. Not `localStorage`. */
const HISTORY_KEY = '21gifts.viewHistory';

/** One-shot target of the top-left arrow. Consumed by the next document. */
const BACK_KEY = '21gifts.viewHistoryBack';

const SLOT = '__giftsViewHistory';

const CAP = 50;

const SAFE_IN_APP_PATH = /^\/[A-Za-z0-9._~/-]*(?:\?[A-Za-z0-9._~%=&*+-]*)?$/;

/**
 * Persisted stack. `base` is how many entries have been dropped off the front.
 * It stays out of storage until the first drop. `historyLength` stays in memory.
 */
type StoredViewHistory = { stack: string[]; cursor: number; base: number };

/**
 * In-memory stack for this document.
 *
 * `historyLength` is the last `history.length` observed here. It is not
 * stored. A push or a replace is whatever the router just did with
 * `pushState` or `replaceState`, not whether `history.length` grew: a browser
 * back drops the forward entry without growing the length, and some browsers
 * stop growing it. A new document is not yet anchored, so its first path is a
 * push unless it is the arrow's one-shot target.
 */
type ViewHistoryMemory = StoredViewHistory & { historyLength: number; anchored: boolean };

type ViewHistoryGlobal = typeof globalThis & { [SLOT]?: ViewHistoryMemory };

type NavKind = 'push' | 'replace';

let navKind: NavKind | null = null;
let historyTapped = false;
let rawReplaceState: History['replaceState'] | null = null;

/**
 * Remember the last router `pushState` or URL-changing `replaceState`.
 * A state-only `replaceState` (the giftsView stamp) is not a navigation.
 */
function installHistoryTap(): void {
  /* v8 ignore next 3 -- SSR never taps history */
  if (historyTapped || typeof window === 'undefined') {
    return;
  }
  historyTapped = true;
  const rawPush = window.history.pushState.bind(window.history);
  const rawReplace = window.history.replaceState.bind(window.history);
  rawReplaceState = rawReplace;
  window.history.pushState = (data, unused, url) => {
    navKind = 'push';
    rawPush(data, unused, url);
  };
  window.history.replaceState = (data, unused, url) => {
    const before = `${window.location.pathname}${window.location.search}`;
    let requested = before;
    if (url !== undefined && url !== null && String(url) !== '') {
      const parsed = new URL(String(url), window.location.href);
      requested = `${parsed.pathname}${parsed.search}`;
    }
    rawReplace(data, unused, url);
    if (requested !== before) {
      navKind = 'replace';
    }
  };
}

/**
 * Last router navigation since the previous record, then clear it.
 *
 * @returns `push`, `replace`, or `null` when the router did not move.
 */
function takeNavKind(): NavKind | null {
  const kind = navKind;
  navKind = null;
  return kind;
}

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
  const hydrated: ViewHistoryMemory = {
    stack: stored.stack,
    cursor: stored.cursor,
    base: stored.base,
    historyLength: window.history.length,
    anchored: false,
  };
  g[SLOT] = hydrated;
  return hydrated;
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
  const created: ViewHistoryMemory = {
    stack: [],
    cursor: 0,
    base: 0,
    historyLength: window.history.length,
    anchored: true,
  };
  (globalThis as ViewHistoryGlobal)[SLOT] = created;
  return created;
}

/**
 * Read the tab stack. A thrown storage read is an empty memory.
 *
 * @returns A stored stack, or `null`.
 */
function readStoredMemory(): StoredViewHistory | null {
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
    const record = parsed as { stack?: unknown; cursor?: unknown; base?: unknown };
    if (!Array.isArray(record.stack) || typeof record.cursor !== 'number') {
      return null;
    }
    const stack = record.stack.filter((entry): entry is string => typeof entry === 'string');
    if (!Number.isInteger(record.cursor) || record.cursor < 0 || record.cursor >= stack.length) {
      return stack.length === 0 ? { stack: [], cursor: 0, base: 0 } : null;
    }
    const rawBase = record.base;
    const base = typeof rawBase === 'number' && rawBase > 0 ? Math.floor(rawBase) : 0;
    return { stack, cursor: record.cursor, base };
  } catch {
    return null;
  }
}

/**
 * Persist the stack, or remove the key when the stack is empty after reset.
 *
 * @param memory - Stack to store, or `null` to clear. Length is not stored.
 */
function writeStoredMemory(memory: StoredViewHistory | null): void {
  try {
    /* v8 ignore next 3 -- SSR has no sessionStorage */
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    if (memory === null) {
      sessionStorage.removeItem(HISTORY_KEY);
      return;
    }
    const payload =
      memory.base > 0
        ? { stack: memory.stack, cursor: memory.cursor, base: memory.base }
        : { stack: memory.stack, cursor: memory.cursor };
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(payload));
  } catch {
    /* Private mode can reject storage; the global slot still holds the stack. */
  }
}

/**
 * Stamp `giftsView` on the current history entry without pushing.
 *
 * @param absolute - `cursor` plus how many entries have been dropped.
 */
function stampGiftsView(absolute: number): void {
  /* v8 ignore next 3 -- SSR has no history */
  if (typeof window === 'undefined') {
    return;
  }
  installHistoryTap();
  /* v8 ignore next 3 -- install keeps the original replaceState */
  if (rawReplaceState === null) {
    return;
  }
  rawReplaceState({ ...window.history.state, giftsView: absolute }, '');
}

/**
 * Remember the path the arrow is opening, so the next document can step back.
 *
 * @param path - In-app path passed to `location.assign`.
 */
function markBackTarget(path: string): void {
  try {
    /* v8 ignore next 3 -- SSR has no sessionStorage */
    if (typeof sessionStorage === 'undefined') {
      return;
    }
    sessionStorage.setItem(BACK_KEY, path);
  } catch {
    /* A missing marker still assigns; the next document pushes that path. */
  }
}

/**
 * Read and drop the arrow's one-shot target.
 *
 * @returns The marked path, or `null` when there is none.
 */
function takeBackTarget(): string | null {
  try {
    /* v8 ignore next 3 -- SSR has no sessionStorage */
    if (typeof sessionStorage === 'undefined') {
      return null;
    }
    const value = sessionStorage.getItem(BACK_KEY);
    sessionStorage.removeItem(BACK_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Step the hydrated stack onto the path the arrow just opened.
 *
 * @param slot - Stack loaded for this new document. Not yet anchored.
 * @param path - Path this document recorded.
 * @returns Whether this record was the arrow's arrival.
 */
function arriveFromBack(slot: ViewHistoryMemory, path: string): boolean {
  if (takeBackTarget() !== path) {
    return false;
  }
  if (slot.cursor >= 1 && slot.stack[slot.cursor - 1] === path) {
    slot.cursor -= 1;
    slot.stack = slot.stack.slice(0, slot.cursor + 1);
    return true;
  }
  if (slot.cursor < 1) {
    slot.stack = [path];
    slot.cursor = 0;
    return true;
  }
  return false;
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
 * Restores a stamped stack index on browser back/forward. A router `pushState`
 * pushes, even when `history.length` does not grow. A URL-changing
 * `replaceState` replaces the current entry once this document is anchored.
 * The first path of a new document is a push, unless it is the arrow's
 * one-shot target, which steps the cursor back. Caps the stack at 50.
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
  const length = window.history.length;
  installHistoryTap();
  const kind = takeNavKind();
  if (!slot.anchored && arriveFromBack(slot, path)) {
    slot.historyLength = length;
    slot.anchored = true;
    stampGiftsView(slot.cursor + slot.base);
    writeStoredMemory(slot);
    return;
  }
  if (slot.anchored) {
    takeBackTarget();
  }
  const stamped = stampedIndex();
  const index = stamped === null ? -1 : stamped - slot.base;
  if (
    stamped !== null &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < slot.stack.length &&
    slot.stack[index] === path
  ) {
    slot.cursor = index;
    slot.historyLength = length;
    slot.anchored = true;
    stampGiftsView(slot.cursor + slot.base);
    writeStoredMemory(slot);
    return;
  }
  if (slot.stack[slot.cursor] === path) {
    if (stamped !== slot.cursor) {
      stampGiftsView(slot.cursor + slot.base);
    }
    slot.historyLength = length;
    slot.anchored = true;
    writeStoredMemory(slot);
    return;
  }
  const replacing = kind === 'replace' && slot.anchored && slot.stack.length > 0;
  if (replacing) {
    const kept = slot.stack.slice(0, slot.cursor + 1);
    kept[slot.cursor] = path;
    slot.stack = kept;
  } else {
    const next = slot.stack.slice(0, slot.cursor + 1);
    next.push(path);
    if (next.length > CAP) {
      next.shift();
      slot.base += 1;
    }
    slot.stack = next;
    slot.cursor = next.length - 1;
  }
  slot.historyLength = length;
  slot.anchored = true;
  stampGiftsView(slot.cursor + slot.base);
  writeStoredMemory(slot);
}

/**
 * Return to the previous in-app view, or open the forum when this tab has none.
 *
 * Assigns that path and leaves the stack for the next document. A second click
 * before that load assigns the same path. A browser back step can leave the
 * site when the current entry replaced an external referrer.
 *
 * @returns void
 */
export function goToPreviousView(): void {
  /* v8 ignore next 3 -- SSR has no location */
  if (typeof window === 'undefined') {
    return;
  }
  const prev = previousViewPath();
  const target = prev ?? '/welcome';
  markBackTarget(target);
  window.location.assign(target);
}
