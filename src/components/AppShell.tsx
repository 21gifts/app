'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
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
  /**
   * Top-left chrome (wordmark / back). Page-absolute `top-4 left-5` except when
   * a `fill` + `align="center"` Card hosts it inside the panel.
   */
  topLeft?: ReactNode;
  /**
   * Top-right chrome (menu / language). Page-absolute `top-4 right-5` except
   * when a `fill` + `align="center"` Card hosts it inside the panel.
   */
  topRight?: ReactNode;
  /** Optional extra class on `<main>` — never viewport height classes. */
  className?: string;
  /**
   * `fill` only. `center` wraps children in a `min-h-full` column flex center
   * inside the overflow scroller (short cards). Never put justify-center on the
   * scroller or `<main>`. `flow` ignores this. Unclaimed `fill` + `center` adds
   * `pt-24` so page-absolute chrome does not sit on the panel corners.
   */
  align?: AppShellAlign;
}

/** Unclaim returned by `claimCardChrome` (`claimed` is true only for the holder). */
type CardChromeUnclaim = (() => void) & { readonly claimed: boolean };

const noopCardChromeUnclaim: CardChromeUnclaim = Object.assign((): void => undefined, {
  claimed: false,
});

interface AppShellContextValue {
  headerEl: HTMLElement | null;
  footerEl: HTMLElement | null;
  topLeftEl: HTMLElement | null;
  setTopLeftEl: (el: HTMLElement | null) => void;
  setHasTopLeftPortal: (value: boolean) => void;
  hasTopLeftPortal: boolean;
  /**
   * Claim exclusive in-card chrome when `chromeInCard` and none is held.
   *
   * @returns Unclaim. `claimed` is true only when this caller became the holder.
   */
  claimCardChrome: () => CardChromeUnclaim;
  chromeInCard: boolean;
  cardChromeClaimed: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);
/** Slot hosts and in-card chrome claim for {@link Card}. Null outside AppShell. */
export { AppShellContext };

/**
 * App page shell driven by `--app-height`. Prefer this over Tailwind
 * viewport-height utilities on app routes. On `fill` + `align="center"`, the
 * first eligible Card may host `topLeft` / `topRight` inside its border.
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
  const [cardChromeClaimed, setCardChromeClaimed] = useState(false);
  const cardChromeHolderRef = useRef(false);
  const chromeInCard = mode === 'fill' && align === 'center';

  const claimCardChrome = useCallback((): CardChromeUnclaim => {
    if (!chromeInCard || cardChromeHolderRef.current) {
      return noopCardChromeUnclaim;
    }
    cardChromeHolderRef.current = true;
    setCardChromeClaimed(true);
    const unclaim = (): void => {
      cardChromeHolderRef.current = false;
      setCardChromeClaimed(false);
    };
    return Object.assign(unclaim, { claimed: true });
  }, [chromeInCard]);

  const ctx = useMemo<AppShellContextValue>(
    () => ({
      headerEl,
      footerEl,
      topLeftEl,
      setTopLeftEl,
      setHasTopLeftPortal,
      hasTopLeftPortal,
      claimCardChrome,
      chromeInCard,
      cardChromeClaimed,
      topLeft,
      topRight,
    }),
    [
      headerEl,
      footerEl,
      topLeftEl,
      hasTopLeftPortal,
      claimCardChrome,
      chromeInCard,
      cardChromeClaimed,
      topLeft,
      topRight,
    ],
  );

  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasRight = topRight !== undefined && topRight !== null;
  const showPageTopLeft = !hasTopLeftPortal && topLeft !== undefined && topLeft !== null;
  const hidePageChrome = chromeInCard && cardChromeClaimed;

  const chrome = hidePageChrome ? null : (
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
            <div
              className={
                cardChromeClaimed
                  ? 'flex min-h-full flex-col items-center justify-center'
                  : 'flex min-h-full flex-col items-center justify-center pt-24'
              }
            >
              {children}
            </div>
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
 * Registers top-left chrome. Child registration wins over the page `topLeft`
 * prop. Without an {@link AppShell} ancestor, renders children inline. The host
 * lives on the page or on the claiming Card.
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
