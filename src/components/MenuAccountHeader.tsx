'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import { useWallet } from '@/hooks/useWallet';
import { fetchAccountActivity, fetchMember, fetchProfilePhoto } from '@/lib/api';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** What the header loads once per session; `null` where it could not be read. */
interface MenuStats {
  receivedSats: number | null;
  givenSats: number | null;
  postCount: number | null;
  /** Object URL of the profile photo, or `null` without one. */
  pictureUrl: string | null;
}

/** Stats of the current session, kept while the document lives. */
let cached: { session: string; stats: MenuStats } | null = null;
/** The load in flight, so two screens mounting at once do not fetch twice. */
let inFlight: { session: string; promise: Promise<MenuStats> } | null = null;

/** Drops the cached photo and numbers (and revokes the photo URL). */
function dropCache(): void {
  if (cached !== null && cached.stats.pictureUrl !== null) {
    URL.revokeObjectURL(cached.stats.pictureUrl);
  }
  cached = null;
}

// A session that ends or changes takes its cache with it, also when no header
// is mounted at that moment (a logout that leaves the page at once).
useAuthStore.subscribe((state) => {
  if (cached !== null && state.session !== cached.session) {
    dropCache();
  }
});

/**
 * Loads the profile photo (`GET /pictures/me`), given and received totals
 * (`GET /me/activity`), and the post count (`GET /forum/members/:id`). A
 * complete load is cached for the session; when the activity or the member
 * read failed, the next mount of the signed-in chrome tries again.
 *
 * @param session - Bearer session.
 * @param accountId - The signed-in account id.
 * @returns The stats, with `null` for what could not be read.
 */
function loadStats(session: string, accountId: string): Promise<MenuStats> {
  if (inFlight?.session === session) {
    return inFlight.promise;
  }
  const promise = Promise.allSettled([
    fetchAccountActivity(session),
    fetchMember(session, accountId),
    fetchProfilePhoto(session),
  ]).then(([activity, member, picture]): MenuStats => {
    const stats: MenuStats = {
      receivedSats: activity.status === 'fulfilled' ? activity.value.receivedSats : null,
      givenSats: activity.status === 'fulfilled' ? activity.value.donatedSats : null,
      postCount:
        member.status === 'fulfilled' && member.value !== null ? member.value.postCount : null,
      pictureUrl: null,
    };
    const current = inFlight?.promise === promise;
    if (current) {
      inFlight = null;
    }
    // Only the current, complete load of the session that is still signed in is kept;
    // anything else is shown once without a photo.
    const signedIn = useAuthStore.getState().session === session;
    if (!current || !signedIn || activity.status === 'rejected' || member.status === 'rejected') {
      return stats;
    }
    if (picture.status === 'fulfilled' && picture.value.type.startsWith('image/')) {
      stats.pictureUrl = URL.createObjectURL(picture.value);
    }
    cached = { session, stats };
    return stats;
  });
  inFlight = { session, promise };
  return promise;
}

/** Props for {@link MenuAccountHeader}. */
export interface MenuAccountHeaderProps {
  /** Closes the Menu after the balance link is followed. */
  onNavigate: () => void;
  /** The compact wide Menu, whose panel has no top padding. */
  tight: boolean;
  /** Whether the Menu is open; closed, the header loads but renders nothing. */
  open: boolean;
}

/** Loading bar in place of a value: same height as its text line. */
const SKELETON_CLASS = 'block rounded bg-app-border animate-pulse motion-reduce:animate-none';

/**
 * Card at the top of the signed-in Menu. The first row is the profile photo
 * (or the name's initial in a circle), display name, and `@username`, which
 * truncate, and in the right corner the wallet balance (₿, the default fiat
 * small under it, right-aligned, never wrapping) as a link to `/wallet`; a
 * skeleton of the same size while the wallet connects, and nothing on error
 * or without a wallet. Under it Received, Given, and Posts, always in their
 * final size: a skeleton bar while loading, `–` when a value could not be
 * read. Received and Given show the default fiat on a small line under the ₿
 * figure (latest gift-day rate; empty only without a usable rate). The photo and the three stats start loading when the signed-in chrome
 * mounts, not when the Menu opens, and are cached for the session; nothing
 * waits for them.
 *
 * @param props - See {@link MenuAccountHeaderProps}.
 * @returns The header card while the Menu is open, or `null` while it is
 *   closed, before the account is loaded, or without a session.
 */
export function MenuAccountHeader({
  onNavigate,
  tight,
  open,
}: MenuAccountHeaderProps): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const accountId = account?.id ?? null;
  const wallet = useWallet();
  const rateDay = useLatestRateDay();
  const [loaded, setLoaded] = useState<{ session: string; stats: MenuStats } | null>(null);

  useEffect(() => {
    if (session === null || accountId === null || cached?.session === session) {
      return;
    }
    let live = true;
    void loadStats(session, accountId).then((stats) => {
      if (live) {
        setLoaded({ session, stats });
      }
    });
    return () => {
      live = false;
    };
  }, [session, accountId]);

  if (account === null || session === null || !open) {
    return null;
  }
  const stats =
    cached?.session === session ? cached.stats : loaded?.session === session ? loaded.stats : null;
  const name = account.name?.trim() ?? '';
  const username = account.username ?? null;
  const initial = (name !== '' ? name : (username ?? '')).charAt(0).toUpperCase();

  let balance: ReactElement | null = null;
  if (
    wallet.status === 'connecting' ||
    (wallet.status === 'ready' && wallet.balanceSats === null)
  ) {
    balance = (
      <div
        role="status"
        aria-label={t('wallet.connecting')}
        className="flex shrink-0 flex-col items-end px-1"
      >
        <span className="flex h-6 items-center">
          <span className={`${SKELETON_CLASS} h-4 w-16`} />
        </span>
        <span className="flex h-4 items-center">
          <span className={`${SKELETON_CLASS} h-3 w-10`} />
        </span>
      </div>
    );
  } else if (wallet.status === 'ready' && wallet.balanceSats !== null) {
    const fiatAmount = satsToFiatAmount(wallet.balanceSats, rateDay, fiat);
    balance = (
      <Link
        href="/wallet"
        onClick={onNavigate}
        className="flex shrink-0 flex-col items-end whitespace-nowrap rounded-lg px-1 no-underline transition hover:bg-app-hover"
      >
        <span className="sr-only">{t('wallet.balanceHeading')}</span>
        <span className="h-6 text-base font-semibold tabular-nums lining-nums text-app-fg">
          {formatBitcoin(wallet.balanceSats, numberFormat)}
        </span>
        <span className="h-4 text-xs tabular-nums lining-nums text-app-muted">
          {fiatAmount === null ? null : formatFiatDisplay(fiatAmount, fiat, numberFormat)}
        </span>
      </Link>
    );
  }

  const skeleton = (width: string, height: string): ReactElement => (
    <span className={`flex ${height} items-center`}>
      <span className={`${SKELETON_CLASS} h-3 ${width}`} />
    </span>
  );
  const shown = (value: number | null | undefined, format: (n: number) => string): string =>
    value === null || value === undefined ? '–' : format(value);
  const bitcoin = (sats: number): string => formatBitcoin(sats, numberFormat);
  const fiatOf = (sats: number | null | undefined): string | null => {
    if (sats === null || sats === undefined) {
      return null;
    }
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null ? null : formatFiatDisplay(amount, fiat, numberFormat);
  };
  /** A ₿ total with its fiat line; both lines keep their height while loading. */
  const amountMetric = (sats: number | null | undefined): ReactElement =>
    stats === null ? (
      <>
        {skeleton('w-12', 'h-4')}
        {skeleton('w-8', 'h-3.5')}
      </>
    ) : (
      <>
        <span className="block h-4 truncate">{shown(sats, bitcoin)}</span>
        <span className="block h-3.5 truncate text-[10px] font-normal text-app-muted">
          {fiatOf(sats)}
        </span>
      </>
    );
  const metrics: { key: string; label: string; value: ReactElement }[] = [
    {
      key: 'received',
      label: t('profile.legendReceived'),
      value: amountMetric(stats?.receivedSats),
    },
    { key: 'given', label: t('profile.legendGiven'), value: amountMetric(stats?.givenSats) },
    {
      key: 'posts',
      label: t('nav.posts'),
      value:
        stats === null ? (
          skeleton('w-8', 'h-4')
        ) : (
          <span className="block h-4 truncate">{shown(stats.postCount, String)}</span>
        ),
    },
  ];

  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-app-card-muted p-3${tight ? ' mt-2' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        {stats?.pictureUrl !== null && stats?.pictureUrl !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL from the profile photo
          <img
            src={stats.pictureUrl}
            alt={t('profile.about.portraitAlt')}
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-border text-base font-semibold text-app-fg"
          >
            {initial}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {name !== '' ? (
            <span className="truncate text-sm font-semibold text-app-fg">{name}</span>
          ) : null}
          {username !== null ? (
            <span className="truncate text-xs text-app-muted">@{username}</span>
          ) : null}
        </div>
        {balance}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {metrics.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col">
            <dt className="truncate text-[11px] text-app-muted">{item.label}</dt>
            <dd className="text-xs font-semibold tabular-nums lining-nums text-app-fg">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
