'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';

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
   * `fill` only. `center` = inner scroller is flex items-center justify-center
   * (short cards). Never justify-center on `<main>`. `flow` ignores this.
   */
  align?: AppShellAlign;
}

type SlotSetter = (node: ReactNode | undefined) => void;

interface AppShellContextValue {
  setHeader: SlotSetter;
  setFooter: SlotSetter;
  setTopLeft: SlotSetter;
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
  const [header, setHeaderState] = useState<ReactNode | undefined>(undefined);
  const [footer, setFooterState] = useState<ReactNode | undefined>(undefined);
  const [slotTopLeft, setSlotTopLeftState] = useState<ReactNode | undefined>(undefined);

  const setHeader = useCallback<SlotSetter>((node) => {
    setHeaderState(node);
  }, []);
  const setFooter = useCallback<SlotSetter>((node) => {
    setFooterState(node);
  }, []);
  const setTopLeft = useCallback<SlotSetter>((node) => {
    setSlotTopLeftState(node);
  }, []);

  const ctx = useMemo<AppShellContextValue>(
    () => ({ setHeader, setFooter, setTopLeft }),
    [setHeader, setFooter, setTopLeft],
  );

  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const effectiveTopLeft = slotTopLeft !== undefined ? slotTopLeft : topLeft;
  const hasLeft = effectiveTopLeft !== undefined && effectiveTopLeft !== null;
  const hasRight = topRight !== undefined && topRight !== null;
  const hasHeader = header !== undefined && header !== null;
  const hasFooter = footer !== undefined && footer !== null;

  const chrome = (
    <>
      {hasLeft ? (
        <div className="absolute top-4 left-5 z-40 flex items-center gap-2">{effectiveTopLeft}</div>
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
          <div className="w-full flex-none pt-24 pb-8">{children}</div>
        </main>
      </AppShellContext.Provider>
    );
  }

  const scrollerAlign = align === 'center' ? ' flex items-center justify-center' : '';

  return (
    <AppShellContext.Provider value={ctx}>
      <main
        className={`relative flex h-[var(--app-height)] flex-col overflow-hidden overscroll-y-none px-6${extra}`}
      >
        {chrome}
        <header className="flex-none">{hasHeader ? header : null}</header>
        <div className={`min-h-0 flex-1 overflow-y-auto${scrollerAlign}`}>{children}</div>
        {hasFooter ? <footer className="flex-none pb-8">{footer}</footer> : null}
      </main>
    </AppShellContext.Provider>
  );
}

/**
 * Registers a flex-none header slot. Without an {@link AppShell} ancestor,
 * renders children inline.
 *
 * @param props - Header content.
 * @returns `null` when portaled into the shell; otherwise the children.
 */
export function AppShellHeader(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  useLayoutEffect(() => {
    if (ctx === null) {
      return;
    }
    ctx.setHeader(props.children);
    return () => {
      ctx.setHeader(undefined);
    };
  }, [ctx, props.children]);

  if (ctx === null) {
    return <>{props.children}</>;
  }
  return null;
}

/**
 * Registers a flex-none footer slot (`pb-8` on the shell footer). Without an
 * {@link AppShell} ancestor, renders children inline.
 *
 * @param props - Footer content (typically CTAs).
 * @returns `null` when portaled into the shell; otherwise the children.
 */
export function AppShellFooter(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  useLayoutEffect(() => {
    if (ctx === null) {
      return;
    }
    ctx.setFooter(props.children);
    return () => {
      ctx.setFooter(undefined);
    };
  }, [ctx, props.children]);

  if (ctx === null) {
    return <>{props.children}</>;
  }
  return null;
}

/**
 * Registers absolute top-left chrome. Child registration wins over the page
 * `topLeft` prop. Without an {@link AppShell} ancestor, renders children inline.
 *
 * @param props - Left chrome (back + wordmark, etc.).
 * @returns `null` when portaled into the shell; otherwise the children.
 */
export function AppShellTopLeft(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  useLayoutEffect(() => {
    if (ctx === null) {
      return;
    }
    ctx.setTopLeft(props.children);
    return () => {
      ctx.setTopLeft(undefined);
    };
  }, [ctx, props.children]);

  if (ctx === null) {
    return <>{props.children}</>;
  }
  return null;
}
