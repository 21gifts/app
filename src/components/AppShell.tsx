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

/**
 * Writing mode of the forum home composer on a touch device. `off`: no such
 * composer on the page, the frame is unchanged. `ready`: the composer is
 * mounted, so the frame, the header row and the footer carry their 250 ms
 * transitions. `on`: the composer's text field has the focus, so the frame is
 * edge to edge, the header row tightens and the footer folds away.
 */
export type AppShellWriting = 'off' | 'ready' | 'on';

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
  frameWidth: number | null;
  setWriting: (writing: AppShellWriting) => void;
  topLeft?: ReactNode;
  topRight?: ReactNode;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);
/** Slot hosts for header, footer, top-left, and the inner scroller. Null outside AppShell. */
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
 * Cards never host page chrome. The context's `setWriting` is called only by
 * the forum home composer on a touch device (`useComposerWriting`): `ready`
 * marks `<main>` `data-writing="ready"` (a `group/shell`) and gives the
 * padding, frame edge, header row and footer their 250 ms transitions; `on`
 * drops `<main>`'s padding and the frame's rounded border, tightens the
 * header row and the page top, and folds the footer away. `off` (every other
 * page) leaves every class as it was.
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
  const [frameEl, setFrameEl] = useState<HTMLElement | null>(null);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [writing, setWriting] = useState<AppShellWriting>('off');

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
      topLeftEl,
      setTopLeftEl,
      setHasTopLeftPortal,
      hasTopLeftPortal,
      scrollerEl,
      frameWidth,
      setWriting,
      topLeft,
      topRight,
    }),
    [headerEl, footerEl, topLeftEl, hasTopLeftPortal, scrollerEl, frameWidth, topLeft, topRight],
  );

  const showPasskeyRenew = useAuthStore(
    (state) => state.account?.walletRequired === false && state.account.passkeyRenewClosed !== true,
  );
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  const hasRight = topRight !== undefined && topRight !== null;
  const showPageTopLeft = !hasTopLeftPortal && topLeft !== undefined && topLeft !== null;
  const writingOn = writing === 'on';
  const fold =
    writing === 'off'
      ? ''
      : ' transition-[padding,border-radius,border-width] duration-250 ease-fold';
  const mainPad = writingOn ? 'p-0' : 'px-3 max-[359px]:px-2 py-2';
  const frameEdge = writingOn ? 'rounded-none border-0' : 'rounded-3xl border';
  const chromeTop = writingOn ? 'pt-2' : 'pt-4';
  const pageTop = writingOn ? 'pt-1 pb-4' : 'py-4';
  // A folding footer keeps its buttons at its bottom edge, so shrinking clips
  // them from the top instead of pushing them below the window.
  const footerClass = writingOn
    ? 'flex flex-none flex-col justify-end px-5 pb-0 empty:hidden writing-folded'
    : writing === 'off'
      ? 'flex-none px-5 pb-5 empty:hidden'
      : 'flex flex-none flex-col justify-end px-5 pb-5 empty:hidden writing-fold';

  return (
    <AppShellContext.Provider value={ctx}>
      <main
        {...(writing === 'off' ? {} : { 'data-writing': writing })}
        className={`${writing === 'off' ? '' : 'group/shell '}relative flex h-[var(--app-height)] flex-col overscroll-y-none ${mainPad}${fold}${extra}`}
      >
        <section
          ref={setFrameEl}
          data-app-frame
          className={`relative flex min-h-0 w-full flex-col grow shrink basis-0 self-stretch overflow-visible ${frameEdge} border-app-border bg-app-card shadow-sm${fold}`}
        >
          <div data-menu-scrim-host className="contents" />
          <div
            data-app-chrome
            className={`relative z-40 flex flex-none items-center justify-between gap-2 px-5 ${chromeTop} pb-1 max-[359px]:px-3${fold}`}
          >
            <div ref={setTopLeftEl} className="flex min-w-0 items-center gap-2 empty:hidden">
              {showPageTopLeft ? topLeft : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2 empty:hidden">
              {hasRight ? topRight : null}
            </div>
          </div>
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
                className={`shell-safe-center flex min-h-full min-w-0 flex-col items-center px-5 ${pageTop}${fold}`}
              >
                {children}
              </div>
            ) : (
              <div
                data-scroll-page
                className={`flex w-full min-w-0 flex-col items-center px-5 ${pageTop}${fold}`}
              >
                {children}
              </div>
            )}
          </Scrollport>
          <footer ref={setFooterEl} className={footerClass} />
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
