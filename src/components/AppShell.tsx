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

/** Visible-viewport lock (`fill`) or document-scroll (`flow`). */
export type AppShellMode = 'fill' | 'flow';

/** Inner-scroller alignment for `fill` only. */
export type AppShellAlign = 'start' | 'center';

/** Props for {@link AppShell}. */
export interface AppShellProps {
  /** Page body (and optional slot registrars). */
  children: ReactNode;
  /** `fill` locks to `--app-height`; `flow` uses min-height and document scroll. */
  mode: AppShellMode;
  /** Absolute top-left chrome (wordmark / back). Out of flow. */
  topLeft?: ReactNode;
  /** Absolute top-right chrome (menu / theme+language). Out of flow. */
  topRight?: ReactNode;
  /** Optional extra class on `<main>` — never viewport height classes. */
  className?: string;
  /**
   * `fill` only. `center` wraps children in a `min-h-full` flex center inside the
   * overflow scroller (short cards). Never put justify-center on the scroller or
   * `<main>`. `flow` ignores this.
   */
  align?: AppShellAlign;
}

interface AppShellContextValue {
  headerEl: HTMLElement | null;
  footerEl: HTMLElement | null;
  topLeftEl: HTMLElement | null;
  setHasTopLeftPortal: (value: boolean) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * App page shell driven by `--app-height`. Prefer this over Tailwind
 * viewport-height utilities on app routes.
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
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const [topLeftEl, setTopLeftEl] = useState<HTMLElement | null>(null);
  const [hasTopLeftPortal, setHasTopLeftPortal] = useState(false);

  const ctx = useMemo<AppShellContextValue>(
    () => ({ headerEl, footerEl, topLeftEl, setHasTopLeftPortal }),
    [headerEl, footerEl, topLeftEl],
  );

  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasRight = topRight !== undefined && topRight !== null;
  const showPageTopLeft = !hasTopLeftPortal && topLeft !== undefined && topLeft !== null;

  const chrome = (
    <>
      <div
        ref={setTopLeftEl}
        className="absolute top-4 left-5 z-40 flex items-center gap-2 empty:hidden"
      />
      {showPageTopLeft ? (
        <div className="absolute top-4 left-5 z-40 flex items-center gap-2">{topLeft}</div>
      ) : null}
      {hasRight ? (
        <div className="absolute top-4 right-5 z-40 flex items-center gap-2">{topRight}</div>
      ) : null}
    </>
  );

  if (mode === 'flow') {
    return (
      <AppShellContext.Provider value={ctx}>
        <main
          className={`relative flex min-h-[var(--app-height)] flex-col items-center px-6${extra}`}
        >
          {chrome}
          <header ref={setHeaderEl} className="flex-none empty:hidden" />
          <div className="flex w-full flex-none flex-col items-center pt-24 pb-8">{children}</div>
          <footer ref={setFooterEl} className="flex-none pb-8 empty:hidden" />
        </main>
      </AppShellContext.Provider>
    );
  }

  return (
    <AppShellContext.Provider value={ctx}>
      <main
        className={`relative flex h-[var(--app-height)] flex-col items-center overflow-hidden overscroll-y-none px-6${extra}`}
      >
        {chrome}
        <header ref={setHeaderEl} className="flex-none w-full empty:hidden" />
        <div className="min-h-0 w-full flex-1 overflow-y-auto">
          {align === 'center' ? (
            <div className="flex min-h-full items-center justify-center">{children}</div>
          ) : (
            children
          )}
        </div>
        <footer ref={setFooterEl} className="flex-none w-full pb-8 empty:hidden" />
      </main>
    </AppShellContext.Provider>
  );
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
 * Registers absolute top-left chrome. Child registration wins over the page
 * `topLeft` prop. Without an {@link AppShell} ancestor, renders children inline.
 *
 * @param props - Left chrome (back + wordmark, etc.).
 * @returns Portal into the shell top-left host, inline children, or `null` before the host mounts.
 */
export function AppShellTopLeft(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  useLayoutEffect(() => {
    if (ctx === null) {
      return;
    }
    ctx.setHasTopLeftPortal(true);
    return () => {
      ctx.setHasTopLeftPortal(false);
    };
  }, [ctx]);

  if (ctx === null) {
    return <>{props.children}</>;
  }
  if (ctx.topLeftEl === null) {
    return null;
  }
  return createPortal(props.children, ctx.topLeftEl);
}
