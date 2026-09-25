'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Home,
  Inbox,
  Menu,
  MessageCircle,
  ScrollText,
  Share2,
  Shield,
  Map,
  Store,
  Banknote,
  User,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { IntroduceYourselfOverlay } from '@/components/IntroduceYourselfOverlay';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { PwaInstall } from '@/components/PwaInstall';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { getAppVersion } from '@/lib/config';
import { FORUM_HOME_EVENT, consumeSkipIntroduceOverlay } from '@/lib/forum-feed';
import type { NumberFormatStyle } from '@/lib/number-format';
import { enablePush, resyncPushSubscription } from '@/lib/push';
import { roleAtLeast } from '@/lib/roles';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatCode,
  type FiatRateDay,
} from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Bitcoin amount plus the visitor's default fiat when a gift-day rate exists. */
function formatMenuAmount(
  sats: number,
  rateDay: FiatRateDay | null,
  fiat: FiatCode,
  numberFormat: NumberFormatStyle,
): string {
  const bitcoin = formatBitcoin(sats, numberFormat);
  const fiatAmount = satsToFiatAmount(sats, rateDay, fiat);
  if (fiatAmount === null) {
    return bitcoin;
  }
  return `${bitcoin} · ${formatFiatDisplay(fiatAmount, fiat, numberFormat)}`;
}

/**
 * Top-right signed-in page chrome: one Menu disclosure; open for icon+label
 * rows (Home, Shops, Map, Point of sale, Profile with same-line given/received amounts only when that
 * side is non-zero, each with the default fiat when a gift-day rate exists, Wallet, living-room rules, Trust Chain, staff-only Moderation
 * (`/moderate`, lucide `Shield`) when `roleAtLeast(account?.role, 'moderator')`
 * with a count (staff-room unread plus open proposals) when greater than zero,
 * notifications with an
 * unread count when greater than zero, messages with an inbox unread count
 * when greater than zero, contact, optional PWA install,
 * and log out). The Menu ends with a quiet
 * Version line (`app.version` / `getAppVersion()`). When onboarding
 * is complete and `hasPosted` is false, also mounts
 * {@link IntroduceYourselfOverlay}. Close dismisses this mount only; the
 * introduce CTA skips the overlay once so a remount after navigating to
 * `/welcome` does not show it again.
 *
 * @returns The signed-in Menu chrome.
 */
export function SignedInChrome(): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const rateDay = useLatestRateDay(session !== null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [introduceDismissed, setIntroduceDismissed] = useState<boolean>(
    consumeSkipIntroduceOverlay,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { donatedSats, receivedSats, loading } = useAccountTotals();
  const { unreadCount, inboxUnreadCount, moderationUnreadCount } = useUnreadCount(open);
  const showIntroduce =
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
      const root = rootRef.current;
      const target = event.target as Node;
      if (root !== null && root.contains(target)) {
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
  }, [open]);

  useEffect(() => {
    if (session === null) {
      return;
    }
    void resyncPushSubscription(session).catch(() => undefined);
  }, [session]);

  const givenAmount = formatMenuAmount(donatedSats, rateDay, fiat, numberFormat);
  const receivedAmount = formatMenuAmount(receivedSats, rateDay, fiat, numberFormat);
  const showGiven = donatedSats > 0;
  const showReceived = receivedSats > 0;
  const showTotalsCluster = loading || showGiven || showReceived;

  return (
    <div ref={rootRef} className="relative">
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
        className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-app-muted transition hover:text-app-fg"
      >
        <Menu aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {t('aria.menu')}
      </button>
      {/* 7rem = main px-6×2 + chrome px-8×2 so the panel stays on-screen at 320px. */}
      <div
        id="signed-in-menu"
        className={`absolute right-0 z-50 mt-2 w-[min(18rem,calc(100vw-7rem))] rounded-xl border border-app-border bg-app-card p-2 shadow-lg ${open ? '' : 'hidden'}`}
      >
        <Link
          href="/welcome"
          onClick={(event) => {
            setOpen(false);
            if (pathname === '/welcome') {
              event.preventDefault();
              window.dispatchEvent(new Event(FORUM_HOME_EVENT));
            }
          }}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
        >
          <Home aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('nav.home')}
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
          href="/map"
          onClick={() => {
            setOpen(false);
          }}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
        >
          <Map aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('nav.map')}
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
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-app-fg no-underline transition hover:bg-app-hover"
        >
          <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{t('profile.title')}</span>
          {showTotalsCluster ? (
            <span className="ml-auto flex items-center gap-2 text-app-muted">
              {loading ? (
                t('forum.loading')
              ) : (
                <>
                  {showGiven ? (
                    <span
                      className="inline-flex items-center gap-1"
                      aria-label={t('profile.given', { amount: givenAmount })}
                      title={t('profile.given', { amount: givenAmount })}
                    >
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold tabular-nums lining-nums">{givenAmount}</span>
                    </span>
                  ) : null}
                  {showGiven && showReceived ? <span aria-hidden="true">·</span> : null}
                  {showReceived ? (
                    <span
                      className="inline-flex items-center gap-1"
                      aria-label={t('profile.received', { amount: receivedAmount })}
                      title={t('profile.received', { amount: receivedAmount })}
                    >
                      <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="font-semibold tabular-nums lining-nums">
                        {receivedAmount}
                      </span>
                    </span>
                  ) : null}
                </>
              )}
            </span>
          ) : null}
        </Link>
        <Link
          href="/wallet"
          onClick={() => {
            setOpen(false);
          }}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
        >
          <Wallet aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('wallet.title')}
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
          href="/trust-chain"
          onClick={() => {
            setOpen(false);
          }}
          className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
        >
          <Share2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('nav.trustChain')}
        </Link>
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
            <span className="ml-auto font-semibold tabular-nums lining-nums">{unreadCount}</span>
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
        <p className="px-3 py-2 text-xs text-app-muted tabular-nums lining-nums">
          {t('app.version', { version: getAppVersion() })}
        </p>
      </div>
      {showIntroduce ? (
        <IntroduceYourselfOverlay
          onDismiss={() => {
            setIntroduceDismissed(true);
          }}
        />
      ) : null}
    </div>
  );
}
