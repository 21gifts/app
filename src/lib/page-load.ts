/**
 * Why this document was loaded, in fixed words for the wallet trace spans.
 *
 * The browser's own record of the load (`PerformanceNavigationTiming.type`)
 * says how the page was loaded. Whether this app's code started it cannot be
 * read from the browser: App Router falls back to a full page load when a
 * client-side navigation cannot complete (a new deploy, a failed page-data
 * request). {@link markAppNavigation} leaves the one word `app` in
 * `sessionStorage` while such a navigation runs, and the recorder of the
 * in-app view stack removes it once the navigation has committed. A load that
 * finds the word was started by that fallback. Nothing else is stored: no
 * path, no time, nothing about the wallet.
 */

/** How the browser loaded this document. */
export type PageLoadKind = 'navigate' | 'reload' | 'back_forward' | 'prerender' | 'unknown';

/** Who started the load: this app's own navigation (`app`), or the member or browser (`other`). */
export type PageLoadTrigger = 'app' | 'other';

/** The two fixed words that describe this document's load. */
export type PageLoad = {
  /** How the browser loaded this document. */
  load: PageLoadKind;
  /** Who started the load. */
  load_trigger: PageLoadTrigger;
};

/** `sessionStorage` key of the marker a client-side navigation leaves while it runs. */
export const APP_NAVIGATION_KEY = '21gifts.load';

/** The only value ever stored under {@link APP_NAVIGATION_KEY}. */
const APP_NAVIGATION_MARK = 'app';

/** Navigation types the browser reports, as they are sent. */
const KINDS: ReadonlySet<string> = new Set(['navigate', 'reload', 'back_forward', 'prerender']);

/** The load of this document, read once; `null` before the first read. */
let captured: PageLoad | null = null;

/**
 * Reads how the browser loaded this document.
 *
 * @returns The navigation type, or `unknown` when the browser reports none.
 */
function navigationKind(): PageLoadKind {
  const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const type = entry?.type;
  return type !== undefined && KINDS.has(type) ? (type as PageLoadKind) : 'unknown';
}

/**
 * Reads and removes the marker of the previous document. Storage that cannot
 * be read counts as no marker.
 *
 * @returns Whether the marker was there.
 */
function takeMarker(): boolean {
  try {
    const found = sessionStorage.getItem(APP_NAVIGATION_KEY) === APP_NAVIGATION_MARK;
    sessionStorage.removeItem(APP_NAVIGATION_KEY);
    return found;
  } catch {
    return false;
  }
}

/**
 * Records why this document was loaded, once per document, and removes the
 * marker the previous document may have left. Called at browser start-up,
 * before the first client-side navigation can write a new marker; later calls
 * return the same record. A load counts as `app` only when it is a `navigate`
 * load that found the marker: a reload or a step through the history while a
 * navigation was still running was the member's.
 *
 * @returns How this document was loaded and who started it.
 */
export function capturePageLoad(): PageLoad {
  if (captured === null) {
    const load = navigationKind();
    const marked = takeMarker();
    captured = { load, load_trigger: marked && load === 'navigate' ? 'app' : 'other' };
  }
  return captured;
}

/**
 * Leaves the `app` marker while a client-side navigation runs, so a full page
 * load that App Router falls back to is counted as started by the app.
 * Storage that cannot be written leaves the next load counted as `other`.
 */
export function markAppNavigation(): void {
  try {
    sessionStorage.setItem(APP_NAVIGATION_KEY, APP_NAVIGATION_MARK);
  } catch {
    // Without storage the fallback load is counted as `other`.
  }
}

/**
 * Removes the `app` marker once a client-side navigation has committed, so a
 * later reload or typed address in this tab is not counted as the app's.
 */
export function clearAppNavigation(): void {
  try {
    sessionStorage.removeItem(APP_NAVIGATION_KEY);
  } catch {
    // Nothing to remove without storage.
  }
}
