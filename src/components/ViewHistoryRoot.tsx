'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { recordCurrentView } from '@/lib/view-history';

/**
 * Top-left chrome override while an in-page step can go back: an ask or shop
 * wizard step, or a wallet Receive or Send view over `/welcome`.
 */
export type ChromeBackOverride = {
  labelKey: 'forum.askBack' | 'shops.back' | 'nav.back';
  onClick: () => void;
  disabled?: boolean;
};

type ChromeBackSlot = {
  id: string;
  override: ChromeBackOverride;
};

type ChromeBackContextValue = {
  override: ChromeBackOverride | null;
  setSlot: (id: string, next: ChromeBackOverride | null) => void;
};

const ChromeBackContext = createContext<ChromeBackContextValue>({
  override: null,
  setSlot: (): void => undefined,
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
  const id = useId();
  const { override, setSlot } = useContext(ChromeBackContext);
  const setOverride = useCallback(
    (next: ChromeBackOverride | null): void => {
      setSlot(id, next);
    },
    [id, setSlot],
  );
  useLayoutEffect(() => {
    return (): void => {
      setSlot(id, null);
    };
  }, [id, setSlot]);
  return { override, setOverride };
}

/**
 * Holds the top-left chrome back override for in-page steps (ask or shop
 * wizard, or a wallet view over `/welcome`). The latest registration wins.
 *
 * @param props - Tree that may register an override.
 * @returns The provider.
 */
export function ChromeBackProvider({ children }: { children: ReactNode }): ReactElement {
  const [slots, setSlots] = useState<readonly ChromeBackSlot[]>([]);
  const setSlot = useCallback((id: string, next: ChromeBackOverride | null): void => {
    setSlots((current) => {
      const without = current.filter((slot) => slot.id !== id);
      if (next === null) {
        return without.length === current.length ? current : without;
      }
      return [...without, { id, override: next }];
    });
  }, []);
  const last = slots[slots.length - 1];
  const override = last === undefined ? null : last.override;
  const value = useMemo((): ChromeBackContextValue => ({ override, setSlot }), [override, setSlot]);
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
  const query = useSearchParams().toString();
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
  }, [onRecorded, pathname, query]);
  useEffect(() => {
    const live = pathFromLocation(pathname);
    if (live !== null) {
      recordCurrentView(live);
    }
  }, [pathname, query]);
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
