'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Load state of a cursor-paged list. `loading` is the first page (nothing is
 * shown yet), `ready` has pages (possibly empty rows), `error` failed to load
 * the first or the next page, and `forbidden` means the api refused this role.
 */
export type CursorPagesStatus = 'loading' | 'ready' | 'error' | 'forbidden';

/** State and actions of {@link useCursorPages}. */
export interface CursorPages<P> {
  /** Load state. */
  status: CursorPagesStatus;
  /** Loaded pages in order; the first page is `pages[0]`. */
  pages: P[];
  /** True while another page may exist. */
  hasMore: boolean;
  /** Loads the failed page again; the error stays shown until the result arrives. */
  retry: () => void;
  /** Mark at the end of the list: the next page loads when it is in view. */
  sentinelRef: RefObject<HTMLLIElement | null>;
}

/**
 * Pages of a list that the api returns with a `nextCursor`, newest first.
 *
 * Loads the first page on mount and again whenever `key` changes (a new
 * member, period, or filter), dropping answers that arrive for an older key.
 * The next page loads when `sentinelRef` is in view, checked again after
 * every completed load, like the `/wallet` payments list. A `null` answer
 * means the api refused this role (403). `load` `null` sends nothing.
 *
 * @param load - Fetches the page before a cursor (`null` for the first page),
 *   or `null` while the caller may not load.
 * @param key - Identity of the list; a change starts again from the first page.
 * @returns Status, loaded pages, and the paging actions.
 */
export function useCursorPages<P extends { nextCursor: string | null }>(
  load: ((before: string | null) => Promise<P | null>) | null,
  key: string,
): CursorPages<P> {
  const [status, setStatus] = useState<CursorPagesStatus>('loading');
  const [pages, setPages] = useState<P[]>([]);
  // A ref, not state: two observer callbacks before the next render must not
  // both start the same page.
  const busy = useRef(false);
  const generation = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const enabled = load !== null;
  const sentinelRef = useRef<HTMLLIElement | null>(null);

  const fetchPage = useCallback((before: string | null, current: number): void => {
    const run = loadRef.current;
    if (run === null) {
      return;
    }
    busy.current = true;
    void run(before)
      .then((page) => {
        if (generation.current !== current) {
          return;
        }
        if (page === null) {
          setStatus('forbidden');
          return;
        }
        setPages((previous) => (before === null ? [page] : [...previous, page]));
        setStatus('ready');
      })
      .catch(() => {
        if (generation.current === current) {
          setStatus('error');
        }
      })
      .finally(() => {
        if (generation.current === current) {
          busy.current = false;
        }
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    generation.current += 1;
    setPages([]);
    setStatus('loading');
    fetchPage(null, generation.current);
  }, [enabled, key, fetchPage]);

  const last = pages[pages.length - 1];
  const cursor = last === undefined ? null : last.nextCursor;
  const hasMore = cursor !== null;

  const loadMore = useCallback((): void => {
    if (busy.current || status !== 'ready' || cursor === null) {
      return;
    }
    fetchPage(cursor, generation.current);
  }, [status, cursor, fetchPage]);

  const retry = useCallback((): void => {
    if (busy.current) {
      return;
    }
    fetchPage(pages.length === 0 ? null : cursor, generation.current);
  }, [pages.length, cursor, fetchPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (node === null || !hasMore || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMore();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
    // Re-armed after every completed load (a load always yields a new array,
    // and an error or retry changes the status), so an end of the list that
    // is still in view asks for the next page again.
  }, [hasMore, loadMore, pages, status]);

  return { status, pages, hasMore, retry, sentinelRef };
}
