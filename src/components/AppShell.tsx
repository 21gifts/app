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
import { DailyPayoutStoppedNotice } from '@/components/DailyPayoutStoppedNotice';
import { PasskeyRenewNotice } from '@/components/PasskeyRenewNotice';
import { Scrollport } from '@/components/ui/Scrollport';
import { useAuthStore } from '@/stores/auth-store';

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
  bodyEl: HTMLElement | null;
  overlayEl: HTMLElement | null;
  topLeftEl: HTMLElement | null;
  setTopLeftEl: (el: HTMLElement | null) => void;
  setHasTopLeftPortal: (value: boolean) => void;
  hasTopLeftPortal: boolean;
  scrollerEl: HTMLElement | null;
  frameWidth: number | null;
  topLeft?: ReactNode;
  topRight?: ReactNode;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);
/**
 * Slot hosts for header, footer, overlay, top-left, the frame body under the
 * header row, and the inner scroller. Null outside AppShell.
 */
export { AppShellContext };

/**
 * App page shell driven by `--app-height`. Prefer this over Tailwind
 * viewport-height utilities on app routes. Always draws one rounded-3xl page
 * frame; wordmark and Menu live in that frame’s first row. The frame
 * (`data-app-frame`) publishes its content-box width as `frameWidth`.
 * `[data-menu-scrim-host]` sits on that frame. `[data-menu-sheet-host]`
 * (`px-5`, the page inset) and `[data-scroll-page]` sit inside the one
 * `[data-scrollport]`. `<main>` has
 * no `overflow-hidden`. The document does not scroll. The scrollport
 * scrolls vertically only. Sideways movement stays inside `[data-scroll-x]`.
 * Cards never host page chrome. Everything under the header row (notices,
 * header slot, scrollport, footer) sits in one positioned frame body
 * (`data-app-body`, a `group/body`), so a layer registered with
 * {@link AppShellOverlay} covers exactly that body: it starts at the header
 * row's bottom edge and ends at the frame's, and it follows the frame when the
 * visible viewport changes. The footer's bottom padding follows
 * `--footer-collapse` on that body (unset: `1.25rem`, as `pb-5`), and glides
 * while the body carries `data-footer-snap` (`WalletFooterActions`). While the
 * body carries `data-footer-fold` that padding is 0, and it glides there and
 * back (280 ms) while the body carries `data-footer-folding`.
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
  const [bodyEl, setBodyEl] = useState<HTMLElement | null>(null);
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);
  const [topLeftEl, setTopLeftEl] = useState<HTMLElement | null>(null);
  const [hasTopLeftPortal, setHasTopLeftPortal] = useState(false);
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null);
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (frameEl === null) return;
    const publish = (width: number): void => {
      setFrameWidth(width > 0 ? width : null);
    };
    publish(frameEl.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const box = Array.isArray(entry.contentBoxSize)
        ? entry.contentBoxSize[0]
        : entry.contentBoxSize;
      publish(box?.inlineSize ?? entry.contentRect.width);
    });
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [frameEl]);

  const ctx = useMemo<AppShellContextValue>(
    () => ({
      headerEl,
      footerEl,
      bodyEl,
      overlayEl,
      topLeftEl,
      setTopLeftEl,
      setHasTopLeftPortal,
      hasTopLeftPortal,
      scrollerEl,
      frameWidth,
      topLeft,
      topRight,
    }),
    [
      headerEl,
      footerEl,
      bodyEl,
      overlayEl,
      topLeftEl,
      hasTopLeftPortal,
      scrollerEl,
      frameWidth,
      topLeft,
      topRight,
    ],
  );

  const showPasskeyRenew = useAuthStore(
    (state) => state.account?.walletRequired === false && state.account.passkeyRenewClosed !== true,
  );
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasRight = topRight !== undefined && topRight !== null;
  const showPageTopLeft = !hasTopLeftPortal && topLeft !== undefined && topLeft !== null;
  return (
    <AppShellContext.Provider value={ctx}>
      <main
        className={`relative flex h-[var(--app-height)] flex-col overscroll-y-none px-3 max-[359px]:px-2 py-2${extra}`}
      >
        <section
          ref={setFrameEl}
          data-app-frame
          className="relative flex min-h-0 w-full flex-col grow shrink basis-0 self-stretch overflow-visible rounded-3xl border border-app-border bg-app-card shadow-sm"
        >
          <div data-menu-scrim-host className="contents" />
          <div
            data-app-chrome
            className="relative z-40 flex flex-none items-center justify-between gap-2 px-5 pt-4 pb-1 max-[359px]:px-3"
          >
            <div ref={setTopLeftEl} className="flex min-w-0 items-center gap-2 empty:hidden">
              {showPageTopLeft ? topLeft : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 empty:hidden">
              {hasRight ? topRight : null}
            </div>
          </div>
          <div
            ref={setBodyEl}
            data-app-body
            className="group/body relative flex min-h-0 w-full flex-1 flex-col"
          >
            {showPasskeyRenew ? <PasskeyRenewNotice /> : null}
            <DailyPayoutStoppedNotice />
            <header ref={setHeaderEl} className="flex-none empty:hidden px-5" />
            <Scrollport
              scrollRef={(node) => {
                setScrollerEl(node);
              }}
              className="w-full flex-1"
            >
              <div data-menu-sheet-host className="px-5" />
              {align === 'center' ? (
                <div
                  data-scroll-page
                  className="shell-safe-center flex min-h-full min-w-0 flex-col items-center px-5 py-4"
                >
                  {children}
                </div>
              ) : (
                <div
                  data-scroll-page
                  className="flex w-full min-w-0 flex-col items-center px-5 py-4"
                >
                  {children}
                </div>
              )}
            </Scrollport>
            <footer
              ref={setFooterEl}
              className="flex-none px-5 pb-[calc(1.25rem-0.5rem*var(--footer-collapse,0))] empty:hidden group-data-[footer-snap]/body:transition-[padding] group-data-[footer-snap]/body:duration-320 group-data-[footer-snap]/body:ease-glide group-data-[footer-fold]/body:pb-0 group-data-[footer-folding]/body:transition-[padding] group-data-[footer-folding]/body:duration-280 group-data-[footer-folding]/body:ease-glide"
            />
            <div ref={setOverlayEl} className="contents" />
          </div>
        </section>
      </main>
    </AppShellContext.Provider>
  );
}

/**
 * The AppShell inner overflow scroller, or `null` outside {@link AppShell}.
 *
 * @returns The `[data-scrollport]` node, or `null` when no shell is mounted.
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
 * Registers a flex-none footer slot (`pb-5` on the shell footer). Without an
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
 * Registers a layer over the frame body: everything under the header row, down
 * to the frame's bottom edge (notices, header slot, scrollport, and footer).
 * The layer positions itself (`absolute inset-0`, or a smaller box) against
 * that body, so it moves with the frame when the visible viewport changes and
 * needs no measured screen coordinates. Without an {@link AppShell} ancestor,
 * renders children inline.
 *
 * @param props - Layer content.
 * @returns Portal into the shell overlay host, inline children, or `null` before the host mounts.
 */
export function AppShellOverlay(props: { children: ReactNode }): ReactElement | null {
  const ctx = useContext(AppShellContext);
  if (ctx === null) {
    return <>{props.children}</>;
  }
  if (ctx.overlayEl === null) {
    return null;
  }
  return createPortal(props.children, ctx.overlayEl);
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
