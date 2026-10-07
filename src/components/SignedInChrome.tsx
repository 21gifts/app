'use client';

import {
  BarChart3,
  Bell,
  HandCoins,
  Home,
  Inbox,
  Menu,
  MessageCircle,
  ListChecks,
  ScrollText,
  Settings,
  Share2,
  Shield,
  Store,
  Banknote,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { AppShellContext, useAppShellScroller } from '@/components/AppShell';
import { IntroduceYourselfOverlay } from '@/components/IntroduceYourselfOverlay';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { MenuAccountHeader } from '@/components/MenuAccountHeader';
import { PwaInstall } from '@/components/PwaInstall';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import { getAppVersion } from '@/lib/config';
import { FORUM_HOME_EVENT, consumeSkipIntroduceOverlay } from '@/lib/forum-feed';
import { enablePush, resyncPushSubscription } from '@/lib/push';
import { roleAtLeast } from '@/lib/roles';
import { bindScrollport, releaseScrollport } from '@/lib/scroll-surface';
import { loadSession } from '@/lib/session-storage';
import { recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-right signed-in page chrome: one Menu disclosure; open, it starts with
 * {@link MenuAccountHeader} (photo, name, balance, Received / Given / Posts),
 * mounted with the chrome so its data loads before the Menu opens (also while a
 * stored session is still being checked, so the header holds its place), and a
 * divider, then icon+label rows (Home first, which clears this tab's view
 * stack on a plain click so the next screen's back arrow returns to the forum
 * home, then Balance (`/wallet`), Shops, Point of sale, Profile with no given or received amounts, Grants for every signed-in member, Settings (`/settings`, lucide `Settings`), living-room rules,
 * Habit-Tracker (`/habit-tracker`), Trust Chain, Statistics
 * (`/statistics`, lucide `BarChart3`) for every signed-in account, then staff-only Moderation
 * (`/moderate`, lucide `Shield`) when `roleAtLeast(account?.role, 'moderator')`
 * with a count (staff-room unread plus open proposals) when greater than zero,
 * notifications with an
 * unread count when greater than zero, messages with an inbox unread count
 * when greater than zero, contact, optional PWA install,
 * and log out). The Menu ends with a quiet
 * Version line (`app.version` / `getAppVersion()`). On a wide frame the panel
 * is an 18rem (`w-72`) portal on the trigger parent and a scrim portals to
 * `[data-menu-scrim-host]` and uses `rounded-3xl` so it follows the frame.
 * On a narrow frame the panel is a full-width sheet in `[data-menu-sheet-host]`
 * (the host has the page's `px-5` inset) and the page underneath is hidden; the
 * open sheet ends above the shell footer and is itself the bound scrollport,
 * so its last rows scroll into view while the page stays put.
 * A wide menu that cannot fit even with its top on the window uses that same
 * sheet, which scrolls the same way. On the
 * forum home (`/welcome`) only, when onboarding is complete and `hasPosted` is
 * false, also mounts {@link IntroduceYourselfOverlay}; it never covers
 * `/wallet`, the point of sale, the profile, messages, setup, or any other
 * screen. Close dismisses this mount only; the introduce CTA skips the overlay
 * once, so the next mount does not show it again.
 *
 * Renders nothing, and starts none of the Menu's reads, while the login card
 * is on screen: a stored session held back until its wallet is open
 * (`lockedSession`), or a session whose wallet is not open in this tab yet
 * (`useWalletOpen`). Both count as signed out.
 *
 * @returns The signed-in Menu chrome, or `null` while the wallet is not open.
 */
export function SignedInChrome(): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const lockedSession = useAuthStore((state) => state.lockedSession);
  const walletOpen = useWalletOpen();
  if (lockedSession !== null || (account !== null && !walletOpen)) {
    return null;
  }
  return <SignedInMenu />;
}

/**
 * The signed-in Menu chrome itself; see {@link SignedInChrome}.
 *
 * @returns The header wallet button and the Menu.
 */
function SignedInMenu(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  // A stored session still being checked keeps the account header's place; read on every
  // auth change, so the sign-out that clears it also removes the header.
  const storedSession = useAuthStore((state) => (state.account === null ? loadSession() : null));
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tight, setTight] = useState(false);
  const [menuLift, setMenuLift] = useState(0);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);
  const [sheetBecauseTall, setSheetBecauseTall] = useState(false);
  const tightRef = useRef(false);
  const menuLiftRef = useRef(0);
  const menuBoxRef = useRef(menuBox);
  tightRef.current = tight;
  menuLiftRef.current = menuLift;
  menuBoxRef.current = menuBox;
  const [introduceDismissed, setIntroduceDismissed] = useState<boolean>(
    consumeSkipIntroduceOverlay,
  );
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const frameWidth = useContext(AppShellContext)?.frameWidth ?? null;
  const scroller = useAppShellScroller();
  const { unreadCount, inboxUnreadCount, moderationUnreadCount } = useUnreadCount(open);
  const showIntroduce =
    pathname === '/welcome' &&
    account !== null &&
    account.setup === null &&
    account.hasPosted === false &&
    !introduceDismissed;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onMouseDown = (event: MouseEvent): void => {
      const root = rootEl;
      const target = event.target as Node;
      const panel = document.getElementById('signed-in-menu');
      if ((root !== null && root.contains(target)) || panel?.contains(target) === true) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, rootEl]);

  const narrow =
    frameWidth !== null
      ? frameWidth < 576
      : typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 36rem)').matches === true;
  const sheet = narrow || sheetBecauseTall;

  useLayoutEffect(() => {
    if (!open || !sheet) {
      delete document.documentElement.dataset['menuSheet'];
      return;
    }
    if (scroller === null) {
      document.documentElement.dataset['menuSheet'] = '1';
      return () => {
        delete document.documentElement.dataset['menuSheet'];
      };
    }
    // Read first. Hiding the page clamps scrollTop to the shorter sheet.
    const previousScrollTop = scroller.scrollTop;
    document.documentElement.dataset['menuSheet'] = '1';
    scroller.scrollTop = 0;
    return () => {
      delete document.documentElement.dataset['menuSheet'];
      scroller.scrollTop = previousScrollTop;
    };
  }, [open, scroller, sheet]);

  // The open sheet is the one scrollport, so its own rows scroll and the page behind stays put.
  // That includes the sheet a wide window uses when the lifted menu still would not fit.
  // The panel stays mounted while closed, so it binds only while open. Crossing the
  // breakpoint moves the portal and so replaces the panel node: bind again.
  const sheetScrolls = open && sheet;
  useLayoutEffect(() => {
    if (!sheetScrolls) {
      return;
    }
    const panel = menuRef.current as HTMLDivElement;
    bindScrollport(panel);
    return () => {
      releaseScrollport(panel);
      // The resync no longer visits the panel once React dropped `data-scrollport`.
      panel.removeAttribute('data-scroll-active');
      panel.removeAttribute('data-scroll-locked');
    };
  }, [sheetScrolls, narrow]);

  useLayoutEffect(() => {
    if (open || !sheetBecauseTall) {
      return;
    }
    setSheetBecauseTall(false);
  }, [open, sheetBecauseTall]);

  useLayoutEffect(() => {
    if (!open || narrow || !sheetBecauseTall) {
      return;
    }
    const onResize = (): void => {
      setSheetBecauseTall(false);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [narrow, open, sheetBecauseTall]);

  useLayoutEffect(() => {
    if (!open || sheet) {
      // Keep the compact measurement while the tall sheet is open, so a
      // taller window can return to that menu instead of the loose one.
      if ((!open || !sheetBecauseTall) && tightRef.current) {
        tightRef.current = false;
        setTight(false);
      }
      if (menuLiftRef.current !== 0) {
        menuLiftRef.current = 0;
        setMenuLift(0);
      }
      if (menuBoxRef.current !== null) {
        menuBoxRef.current = null;
        setMenuBox(null);
      }
      return;
    }
    const measure = (): void => {
      // A node that has left the document is not a box anyone can see.
      const panel = document.getElementById('signed-in-menu');
      if (panel === null) {
        return;
      }
      const limit = window.innerHeight + 1;
      const rect = panel.getBoundingClientRect();
      const applied = menuLiftRef.current;
      const fixed = panel.classList.contains('fixed');
      // A fixed box is already shifted. Add the lift back. An absolute box is natural.
      const naturalBottom = rect.bottom + (fixed ? applied : 0);
      const naturalTop = rect.top + (fixed ? applied : 0);
      // A fixed panel's left is the inline value from the last measure. The trigger
      // moves when the frame resizes, so the horizontal position comes from the
      // trigger parent. An absolute panel is already in that parent.
      const anchorRight = rootEl?.getBoundingClientRect().right;
      const naturalLeft =
        fixed && typeof anchorRight === 'number' ? anchorRight - rect.width : rect.left;
      const currentTight = tightRef.current;
      // Compact is 40px shorter (mt-2 to mt-0, p-2 to py-0, version py-2 to py-0) plus 8px reserve.
      const nextTight =
        naturalBottom > limit
          ? true
          : currentTight && naturalBottom <= limit - 48
            ? false
            : currentTight;
      // Wait until the compact absolute box is on screen, then pin that measurement.
      if (nextTight !== currentTight) {
        tightRef.current = nextTight;
        setTight(nextTight);
        return;
      }
      // A second scroll is forbidden. Lift only while the bottom stays in the window.
      // When the compact menu cannot fit even at the top, use the narrow sheet.
      const overflow = Math.ceil(naturalBottom - limit);
      const room = Math.max(0, Math.floor(naturalTop));
      if (nextTight && overflow > room) {
        setSheetBecauseTall(true);
        return;
      }
      const nextLift = nextTight && overflow > 0 ? Math.min(overflow, room) : 0;
      const nextBox =
        nextLift > 0
          ? {
              top: Math.round(naturalTop - nextLift),
              left: Math.round(naturalLeft),
              width: Math.round(rect.width),
            }
          : null;
      const previous = menuBoxRef.current;
      const sameBox =
        (nextBox === null && previous === null) ||
        (nextBox !== null &&
          previous !== null &&
          previous.top === nextBox.top &&
          previous.left === nextBox.left &&
          previous.width === nextBox.width);
      if (nextLift !== applied) {
        menuLiftRef.current = nextLift;
        setMenuLift(nextLift);
      }
      if (!sameBox) {
        menuBoxRef.current = nextBox;
        setMenuBox(nextBox);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(menuRef.current!);
    }
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [account?.role, open, rootEl, sheet, sheetBecauseTall, tight]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    void resyncPushSubscription(session).catch(() => undefined);
  }, [session]);

  // Stay in the sheet host while closed. Moving the portal back to the
  // trigger remounts the panel, and the iOS install sheet is state on
  // that panel. `rootEl` is null on the first render, so the server and
  // the hydration pass both skip the portal.
  const sheetHost =
    rootEl !== null && sheet && typeof document !== 'undefined'
      ? document.querySelector('[data-menu-sheet-host]')
      : null;
  // `querySelector` is already an element or null. Do not touch `HTMLElement`:
  // that name does not exist while this component renders on the server.
  const panelTarget = sheetHost ?? rootEl;
  const scrimHost =
    open && !sheet && typeof document !== 'undefined'
      ? document.querySelector('[data-menu-scrim-host]')
      : null;
  // A percentage width resolves against the trigger, which is only as
  // wide as the button, so the wide panel is a fixed 18rem.
  // A tall wide menu drops its outer spacing. Rows stay at least 44px. If it still
  // passes the window, the panel becomes a fixed overlay whose measured top, left,
  // and width keep the bottom on the window and never use a negative top. It does not
  // scroll. When that lift would leave the bottom outside, the wide menu uses the
  // same sheet as a narrow frame. The trigger stays above a lifted panel so Menu
  // still receives the click that closes it.
  const lifted = !sheet && menuBox !== null;
  const panelClass = sheet
    ? `w-full rounded-xl border border-app-border bg-app-card p-2${open ? '' : ' hidden'}`
    : lifted
      ? `fixed z-50 w-72 rounded-xl border border-app-border bg-app-card px-2 py-0 shadow-lg${open ? '' : ' hidden'}`
      : tight
        ? `absolute right-0 z-50 mt-0 w-72 rounded-xl border border-app-border bg-app-card px-2 py-0 shadow-lg${open ? '' : ' hidden'}`
        : `absolute right-0 z-50 mt-2 w-72 rounded-xl border border-app-border bg-app-card p-2 shadow-lg${open ? '' : ' hidden'}`;

  return (
    <div className="flex items-center">
      <div ref={setRootEl} className="relative">
        <button
          ref={buttonRef}
          type="button"
          id="signed-in-menu-button"
          aria-expanded={open}
          aria-controls="signed-in-menu"
          aria-label={t('aria.menu')}
          onClick={() => {
            setOpen((current) => !current);
          }}
          className={
            lifted
              ? 'relative z-[60] inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-app-muted transition hover:text-app-fg'
              : 'inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-app-muted transition hover:text-app-fg'
          }
        >
          <Menu aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('aria.menu')}
        </button>
        {panelTarget === null
          ? null
          : createPortal(
              <div
                id="signed-in-menu"
                ref={menuRef}
                className={panelClass}
                style={
                  lifted && menuBox !== null
                    ? { top: menuBox.top, left: menuBox.left, width: menuBox.width }
                    : undefined
                }
                {...(sheetScrolls ? { 'data-scrollport': '' } : {})}
              >
                {account !== null || storedSession !== null ? (
                  <>
                    <MenuAccountHeader
                      tight={tight}
                      open={open}
                      onNavigate={() => {
                        setOpen(false);
                      }}
                    />
                    <div aria-hidden="true" className="my-2 border-t border-app-border" />
                  </>
                ) : null}
                <Link
                  href="/welcome"
                  onClick={(event) => {
                    setOpen(false);
                    const plain =
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey &&
                      event.button === 0;
                    if (plain) {
                      resetViewHistory();
                    }
                    if (pathname === '/welcome') {
                      event.preventDefault();
                      if (plain) {
                        recordCurrentView(`${window.location.pathname}${window.location.search}`);
                      }
                      window.dispatchEvent(new Event(FORUM_HOME_EVENT));
                    }
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Home aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.home')}
                </Link>
                <Link
                  href="/wallet"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Wallet aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('wallet.balanceHeading')}
                </Link>
                <Link
                  href="/shops"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Store aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.shops')}
                </Link>
                <Link
                  href="/pos"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Banknote aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('pos.nav')}
                </Link>
                <Link
                  href="/profile"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('profile.title')}
                </Link>
                <Link
                  href="/grants"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <HandCoins aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.grants')}
                </Link>
                <Link
                  href="/settings"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Settings aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.settings')}
                </Link>
                <Link
                  href="/rules"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <ScrollText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.rules')}
                </Link>
                <Link
                  href="/habit-tracker"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <ListChecks aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.habitTracker')}
                </Link>
                <Link
                  href="/trust-chain"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Share2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.trustChain')}
                </Link>
                {account !== null ? (
                  <Link
                    href="/statistics"
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                  >
                    <BarChart3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {t('nav.statistics')}
                  </Link>
                ) : null}
                {roleAtLeast(account?.role, 'moderator') ? (
                  <Link
                    href="/moderate"
                    aria-label={
                      moderationUnreadCount > 0
                        ? t('nav.moderateUnread', { count: String(moderationUnreadCount) })
                        : t('nav.moderate')
                    }
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                  >
                    <Shield aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {t('nav.moderate')}
                    {moderationUnreadCount > 0 ? (
                      <span className="ml-auto font-semibold tabular-nums lining-nums">
                        {moderationUnreadCount}
                      </span>
                    ) : null}
                  </Link>
                ) : null}
                <Link
                  href="/notifications"
                  aria-label={
                    unreadCount > 0
                      ? t('nav.notificationsUnread', { count: String(unreadCount) })
                      : t('nav.notifications')
                  }
                  onClick={() => {
                    setOpen(false);
                    if (session === null) {
                      return;
                    }
                    if (
                      typeof Notification !== 'undefined' &&
                      Notification.permission !== 'granted' &&
                      typeof navigator.serviceWorker !== 'undefined' &&
                      typeof window.PushManager !== 'undefined'
                    ) {
                      void enablePush(session).catch(() => undefined);
                    } else {
                      void resyncPushSubscription(session).catch(() => undefined);
                    }
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Bell aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.notifications')}
                  {unreadCount > 0 ? (
                    <span className="ml-auto font-semibold tabular-nums lining-nums">
                      {unreadCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href="/messages"
                  aria-label={
                    inboxUnreadCount > 0
                      ? t('nav.inboxUnread', { count: String(inboxUnreadCount) })
                      : t('nav.inbox')
                  }
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <Inbox aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.inbox')}
                  {inboxUnreadCount > 0 ? (
                    <span className="ml-auto font-semibold tabular-nums lining-nums">
                      {inboxUnreadCount}
                    </span>
                  ) : null}
                </Link>
                <Link
                  href="/contact"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
                >
                  <MessageCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {t('nav.contact')}
                </Link>
                <PwaInstall
                  placement="menu"
                  onMenuAction={() => {
                    setOpen(false);
                  }}
                />
                <LogoutButton />
                <p
                  className={
                    tight
                      ? 'px-3 py-0 text-xs text-app-muted tabular-nums lining-nums'
                      : 'px-3 py-2 text-xs text-app-muted tabular-nums lining-nums'
                  }
                >
                  {t('app.version', { version: getAppVersion() })}
                </p>
              </div>,
              panelTarget,
            )}
        {scrimHost !== null
          ? createPortal(
              <button
                type="button"
                id="signed-in-menu-scrim"
                tabIndex={-1}
                aria-label={t('aria.menuDismiss')}
                className="absolute inset-0 z-40 rounded-3xl bg-app-overlay"
                onClick={() => {
                  setOpen(false);
                }}
              />,
              scrimHost,
            )
          : null}
        {showIntroduce ? (
          <IntroduceYourselfOverlay
            onDismiss={() => {
              setIntroduceDismissed(true);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
