'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { ButtonLink } from '@/components/ui';
import { useMyLoans } from '@/hooks/useMyLoans';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet } from '@/hooks/useWallet';
import { fetchProfilePhoto } from '@/lib/api';
import { loadSession } from '@/lib/session-storage';
import { summarizeLoans } from '@/lib/loan-repay';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/** Object URL of the profile photo of the current session (`null` without one), kept while the document lives. */
let cached: { session: string; pictureUrl: string | null } | null = null;
/** The load in flight, so two screens mounting at once do not fetch twice. */
let inFlight: { session: string; promise: Promise<string | null> } | null = null;

/** Drops the cached photo (and revokes its URL). */
function dropCache(): void {
  if (cached !== null && cached.pictureUrl !== null) {
    URL.revokeObjectURL(cached.pictureUrl);
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
 * Loads the profile photo (`GET /pictures/me`) and caches it for the session.
 *
 * @param session - Bearer session.
 * @returns Object URL of the photo, or `null` without one or when it could not be read.
 */
function loadPhoto(session: string): Promise<string | null> {
  if (inFlight?.session === session) {
    return inFlight.promise;
  }
  const promise = fetchProfilePhoto(session).then(
    (picture): string | null => {
      const current = inFlight?.promise === promise;
      if (current) {
        inFlight = null;
      }
      // Only the current load of the session that is still signed in is kept.
      if (!current || useAuthStore.getState().session !== session) {
        return null;
      }
      const pictureUrl = picture.type.startsWith('image/') ? URL.createObjectURL(picture) : null;
      cached = { session, pictureUrl };
      return pictureUrl;
    },
    (): null => {
      if (inFlight?.promise === promise) {
        inFlight = null;
      }
      return null;
    },
  );
  inFlight = { session, promise };
  return promise;
}

/** Props for {@link MenuAccountHeader}. */
export interface MenuAccountHeaderProps {
  /** Closes the Menu after the profile or the balance link is followed. */
  onNavigate: () => void;
  /** The compact wide Menu, whose panel has no top padding. */
  tight: boolean;
  /** Whether the Menu is open; closed, the header loads but renders nothing. */
  open: boolean;
}

/**
 * Loading bar in place of a value: same height as its text line. Shared with
 * the header balance, so there is one skeleton look.
 */
export const SKELETON_CLASS =
  'block rounded bg-app-border animate-pulse motion-reduce:animate-none';

/**
 * Card at the top of the signed-in Menu. The first row is the profile photo
 * (or the name's initial in a circle), display name, and `@username`, which
 * truncate, together one link to `/profile`, and in the right corner the wallet balance (₿, the default fiat
 * small under it, right-aligned, never wrapping) as a link to `/wallet`; a
 * skeleton of the same size while the wallet connects, and nothing on error
 * or without a wallet. A currently payable loan adds its due row under it;
 * loans re-read whenever the Menu opens while the current shared body stays
 * visible. The photo starts loading when the signed-in chrome
 * mounts, not when the Menu opens, and is cached for the session (a failed
 * read is tried again on the next mount); nothing waits for it. Until the
 * account is loaded (a stored session still being checked right after a page
 * load), the card already has its final size: a skeleton circle for the photo
 * and skeleton bars for the name and `@username`; that placeholder is not a
 * link.
 *
 * @param props - See {@link MenuAccountHeaderProps}.
 * @returns The header card while the Menu is open, or `null` while it is
 *   closed or when signed out (no session and none stored).
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
  // Read on every auth change, so a sign-out that clears the stored session also clears the card.
  const storedSession = useAuthStore((state) =>
    state.session === null || state.account === null ? loadSession() : null,
  );
  const signedIn = session !== null && account !== null;
  const wallet = useWallet();
  const { loans, reload: reloadLoans } = useMyLoans();
  const rateDay = useSpotRate();
  const [loaded, setLoaded] = useState<{ session: string; pictureUrl: string | null } | null>(null);

  useEffect(() => {
    if (session === null || !signedIn || cached?.session === session) {
      return;
    }
    let live = true;
    void loadPhoto(session).then((pictureUrl) => {
      if (live) {
        setLoaded({ session, pictureUrl });
      }
    });
    return () => {
      live = false;
    };
  }, [session, signedIn]);

  useEffect(() => {
    if (open) {
      void reloadLoans();
    }
  }, [open, reloadLoans]);

  if (!open) {
    return null;
  }
  const pending = account === null || session === null;
  if (pending && storedSession === null) {
    return null;
  }
  const pictureUrl = pending
    ? null
    : cached?.session === session
      ? cached.pictureUrl
      : loaded?.session === session
        ? loaded.pictureUrl
        : null;
  const name = account?.name?.trim() ?? '';
  const username = account?.username ?? null;
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

  const loanSummary = loans === null ? null : summarizeLoans(loans);

  return (
    <div className={`flex flex-col gap-3 rounded-xl bg-app-card-muted p-3${tight ? ' mt-2' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        {pending ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className={`${SKELETON_CLASS} h-10 w-10 shrink-0 rounded-full`}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span aria-hidden="true" className="flex h-5 items-center">
                <span className={`${SKELETON_CLASS} h-3.5 w-24`} />
              </span>
              <span aria-hidden="true" className="flex h-4 items-center">
                <span className={`${SKELETON_CLASS} h-3 w-16`} />
              </span>
            </div>
          </div>
        ) : (
          // 44px tap target; the negative margins keep the row at the photo's 40px.
          <Link
            href="/profile"
            onClick={onNavigate}
            className="-mx-1 -my-0.5 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 no-underline transition hover:bg-app-hover"
          >
            <span className="sr-only">{t('nav.openProfile')}</span>
            {pictureUrl !== null ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob URL from the profile photo
              <img
                src={pictureUrl}
                alt=""
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
            <span className="flex min-w-0 flex-1 flex-col">
              {name !== '' ? (
                <span className="h-5 truncate text-sm font-semibold text-app-fg">{name}</span>
              ) : null}
              {username !== null ? (
                <span className="h-4 truncate text-xs text-app-muted">@{username}</span>
              ) : null}
            </span>
          </Link>
        )}
        {balance}
      </div>
      {loanSummary?.payable === true ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-app-card px-3 py-2">
          <div className="min-w-0">
            <p
              className={`text-[11px] ${
                loanSummary.behindDays > 0 ? 'font-medium text-app-danger' : 'text-app-muted'
              }`}
            >
              {t(loanSummary.behindDays > 0 ? 'loans.menuBehind' : 'loans.menuDue')}
            </p>
            <p
              className={`text-sm font-semibold tabular-nums lining-nums ${
                loanSummary.behindDays > 0 ? 'text-app-danger' : 'text-app-fg'
              }`}
            >
              {formatBitcoin(loanSummary.payableSats, numberFormat)}
              {preferredFiatSuffix(loanSummary.payableSats, rateDay, fiat, numberFormat)}
            </p>
          </div>
          <ButtonLink href="/loans/repay" size="sm" onClick={onNavigate}>
            {t('wallet.payFromWallet')}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
