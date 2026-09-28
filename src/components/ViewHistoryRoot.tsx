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
 * Records the current pathname and search on the in-app view stack.
 *
 * `useSearchParams` can suspend, so the page chrome may paint before this
 * recorder commits. The layout effect records again and asks the root to
 * re-render, so the top-left arrow reads the stack that includes this view.
 *
 * @param props - Stable callback that re-renders the chrome after a record.
 * @returns `null` (side-effect only).
 */
function RecordView({ onRecorded }: { onRecorded: () => void }): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const path = query === '' ? pathname : `${pathname}?${query}`;
  if (typeof pathname === 'string' && pathname !== '') {
    recordCurrentView(path);
  }
  useLayoutEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') {
      recordCurrentView(path);
      onRecorded();
    }
  }, [onRecorded, path, pathname]);
  useEffect(() => {
    if (typeof pathname === 'string' && pathname !== '') {
      recordCurrentView(path);
    }
  }, [path, pathname]);
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
      <Suspense fallback={null}>
        <RecordView onRecorded={onRecorded} />
      </Suspense>
      {children}
    </ChromeBackProvider>
  );
}
