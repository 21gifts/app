'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { recordCurrentView } from '@/lib/view-history';

/** Top-left chrome override while an in-page wizard step can go back. */
export type ChromeBackOverride = {
  labelKey: 'forum.askBack';
  onClick: () => void;
  disabled?: boolean;
};

type ChromeBackContextValue = {
  override: ChromeBackOverride | null;
  setOverride: (next: ChromeBackOverride | null) => void;
};

const ChromeBackContext = createContext<ChromeBackContextValue>({
  override: null,
  setOverride: (): void => undefined,
});

/**
 * Read the chrome back override. Without a provider, `override` is `null` and
 * `setOverride` is a no-op.
 *
 * @returns The current override and a setter.
 */
export function useChromeBack(): {
  override: ChromeBackOverride | null;
  setOverride: (next: ChromeBackOverride | null) => void;
} {
  return useContext(ChromeBackContext);
}

/**
 * Holds the top-left chrome back override for in-page steps (ask wizard).
 *
 * @param props - Tree that may register an override.
 * @returns The provider.
 */
export function ChromeBackProvider({ children }: { children: ReactNode }): ReactElement {
  const [override, setOverride] = useState<ChromeBackOverride | null>(null);
  const value = useMemo((): ChromeBackContextValue => ({ override, setOverride }), [override]);
  return <ChromeBackContext.Provider value={value}>{children}</ChromeBackContext.Provider>;
}

/**
 * Current in-app path from the router pathname and the live location search.
 *
 * Search is taken from `window.location` only when it still matches the
 * pathname. A router pathname the location has not reached is not recorded,
 * so a query is not stored as a separate hop.
 *
 * @param pathname - Router pathname, or null before the router is ready.
 * @returns The path to record, or `null` when there is nothing to record.
 */
function pathFromLocation(pathname: string | null): string | null {
  if (typeof pathname !== 'string' || pathname === '') {
    return null;
  }
  /* v8 ignore next 3 -- SSR has no location */
  if (typeof window === 'undefined') {
    return pathname;
  }
  if (window.location.pathname !== pathname) {
    return null;
  }
  const search = window.location.search;
  if (search === '' || search === '?') {
    return pathname;
  }
  return `${pathname}${search}`;
}

/**
 * Records the current view before paint, without `useSearchParams`.
 *
 * A recorder that suspends does not commit before the next full navigation,
 * so the view the visitor just saw never reaches the stack.
 *
 * @param props - Stable callback that re-renders the chrome after a record.
 * @returns `null` (side-effect only).
 */
function RecordLocation({ onRecorded }: { onRecorded: () => void }): null {
  const pathname = usePathname();
  const path = pathFromLocation(pathname);
  if (path !== null) {
    recordCurrentView(path, false);
  }
  useLayoutEffect(() => {
    const live = pathFromLocation(pathname);
    if (live !== null) {
      recordCurrentView(live);
      onRecorded();
    }
  }, [onRecorded, pathname, path]);
  return null;
}

/**
 * Re-renders when the search changes. The recorded path is the live location,
 * the same string as {@link pathFromLocation}, and only after that location
 * has reached the router pathname.
 *
 * @param props - Stable callback that re-renders the chrome after a record.
 * @returns `null` (side-effect only).
 */
function RecordQuery({ onRecorded }: { onRecorded: () => void }): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const path = pathFromLocation(pathname);
  if (path !== null) {
    recordCurrentView(path, false);
  }
  useLayoutEffect(() => {
    const live = pathFromLocation(pathname);
    if (live !== null) {
      recordCurrentView(live);
      onRecorded();
    }
  }, [onRecorded, pathname, searchParams]);
  useEffect(() => {
    const live = pathFromLocation(pathname);
    if (live !== null) {
      recordCurrentView(live);
    }
  }, [pathname, searchParams]);
  return null;
}

/**
 * Root recorder for the in-app view stack, plus the chrome back override.
 *
 * @param props - App tree under the layout providers.
 * @returns Children wrapped with the chrome-back provider and the recorder.
 */
export function ViewHistoryRoot({ children }: { children: ReactNode }): ReactElement {
  const [, setTick] = useState(0);
  const onRecorded = useCallback((): void => {
    setTick((current) => current + 1);
  }, []);
  return (
    <ChromeBackProvider>
      <RecordLocation onRecorded={onRecorded} />
      <Suspense fallback={null}>
        <RecordQuery onRecorded={onRecorded} />
      </Suspense>
      {children}
    </ChromeBackProvider>
  );
}
