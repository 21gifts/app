'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/** Kept on the API; `fill` and `flow` render the same page-frame geometry. */
export type AppShellMode = 'fill' | 'flow';

/** Inner-scroller alignment. Only the inner wrapper under `center` may center. */
export type AppShellAlign = 'start' | 'center';

/** Props for {@link AppShell}. */
export interface AppShellProps {
  /** Page body (and optional slot registrars). */
  children: ReactNode;
  /**
   * Kept so call sites compile. Both values draw the same page frame with an
   * inner scroller.
   */
  mode: AppShellMode;
  /** Top-left chrome (wordmark / back) in the frame header row. */
  topLeft?: ReactNode;
  /** Top-right chrome (menu / language) in the frame header row. */
  topRight?: ReactNode;
  /** Optional extra class on `<main>` — never viewport height classes. */
  className?: string;
  /**
   * Inner-scroller alignment. `center` wraps children in a `min-h-full` column
   * flex center. Never put justify-center on the scroller or `<main>`.
   */
  align?: AppShellAlign;
}

interface AppShellContextValue {
  headerEl: HTMLElement | null;
  footerEl: HTMLElement | null;
  topLeftEl: HTMLElement | null;
  setTopLeftEl: (el: HTMLElement | null) => void;
  setHasTopLeftPortal: (value: boolean) => void;
  hasTopLeftPortal: boolean;
  scrollerEl: HTMLElement | null;
  topLeft?: ReactNode;
  topRight?: ReactNode;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);
/** Slot hosts for header, footer, top-left, and the inner scroller. Null outside AppShell. */
export { AppShellContext };

/**
 * App page shell driven by `--app-height`. Prefer this over Tailwind
 * viewport-height utilities on app routes. Always draws one rounded-3xl page
 * frame; wordmark and Menu live in that frame’s first row. Content scrolls
 * inside the frame. Cards never host page chrome.
 *
 * @param props - See {@link AppShellProps}.
 * @returns The page shell element.
 */
export function AppShell({
  children,
  mode,
  topLeft,
  topRight,
  className,
  align = 'start',
}: AppShellProps): ReactElement {
  void mode;
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const [topLeftEl, setTopLeftEl] = useState<HTMLElement | null>(null);
  const [hasTopLeftPortal, setHasTopLeftPortal] = useState(false);
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null);

  const ctx = useMemo<AppShellContextValue>(
    () => ({
      headerEl,
      footerEl,
      topLeftEl,
      setTopLeftEl,
      setHasTopLeftPortal,
      hasTopLeftPortal,
      scrollerEl,
      topLeft,
      topRight,
    }),
    [headerEl, footerEl, topLeftEl, hasTopLeftPortal, scrollerEl, topLeft, topRight],
  );

  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasRight = topRight !== undefined && topRight !== null;
  const showPageTopLeft = !hasTopLeftPortal && topLeft !== undefined && topLeft !== null;

  return (
    <AppShellContext.Provider value={ctx}>
      <main
        className={`relative flex h-[var(--app-height)] flex-col overscroll-y-none px-6 py-4${extra}`}
      >
        <section className="flex min-h-0 w-full flex-col grow shrink basis-0 self-stretch overflow-visible rounded-3xl border border-app-border bg-app-card shadow-sm">
          <div
            data-app-chrome
            className="relative z-40 flex flex-none items-center justify-between gap-2 px-8 pt-6 pb-2"
          >
            <div ref={setTopLeftEl} className="flex min-w-0 items-center gap-2 empty:hidden">
              {showPageTopLeft ? topLeft : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 empty:hidden">
              {hasRight ? topRight : null}
            </div>
          </div>
          <header ref={setHeaderEl} className="flex-none empty:hidden px-8" />
          <div ref={setScrollerEl} className="min-h-0 w-full flex-1 overflow-y-auto">
            {align === 'center' ? (
              <div className="flex min-h-full flex-col items-center justify-[safe_center] px-8 py-6">
                {children}
              </div>
            ) : (
              <div className="flex w-full flex-col items-center px-8 py-6">{children}</div>
            )}
          </div>
          <footer ref={setFooterEl} className="flex-none px-8 pb-8 empty:hidden" />
        </section>
      </main>
    </AppShellContext.Provider>
  );
}

/**
 * The AppShell inner overflow scroller, or `null` outside {@link AppShell}.
 *
 * @returns The `overflow-y-auto` node, or `null` when no shell is mounted.
 */
export function useAppShellScroller(): HTMLElement | null {
  const ctx = useContext(AppShellContext);
  if (ctx === null) {
    return null;
  }
  return ctx.scrollerEl;
}

/**
 * Registers a flex-none header slot. Without an {@link AppShell} ancestor,
 * renders children inline.
 *
 * @param props - Header content.
 * @returns Portal into the shell header, inline children, or `null` before the host mounts.
 */
export function AppShellHeader(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  if (ctx === null) {
    return <>{props.children}</>;
  }
  if (ctx.headerEl === null) {
    return null;
  }
  return createPortal(props.children, ctx.headerEl);
}

/**
 * Registers a flex-none footer slot (`pb-8` on the shell footer). Without an
 * {@link AppShell} ancestor, renders children inline.
 *
 * @param props - Footer content (typically CTAs).
 * @returns Portal into the shell footer, inline children, or `null` before the host mounts.
 */
export function AppShellFooter(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  if (ctx === null) {
    return <>{props.children}</>;
  }
  if (ctx.footerEl === null) {
    return null;
  }
  return createPortal(props.children, ctx.footerEl);
}

/**
 * Registers top-left chrome. Child registration wins over the page `topLeft`
 * prop. Without an {@link AppShell} ancestor, renders children inline. The host
 * is the frame chrome row, not a Card.
 *
 * @param props - Left chrome (back + wordmark, etc.).
 * @returns Portal into the shell top-left host, inline children, or `null` before the host mounts.
 */
export function AppShellTopLeft(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  const setHasTopLeftPortal = ctx === null ? undefined : ctx.setHasTopLeftPortal;
  useLayoutEffect(() => {
    if (setHasTopLeftPortal === undefined) {
      return;
    }
    setHasTopLeftPortal(true);
    return () => {
      setHasTopLeftPortal(false);
    };
  }, [setHasTopLeftPortal]);

  if (ctx === null) {
    return <>{props.children}</>;
  }
  if (ctx.topLeftEl === null) {
    return null;
  }
  return createPortal(props.children, ctx.topLeftEl);
}
