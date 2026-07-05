'use client';

import { AlertTriangle, Clock, Loader2, LogOut, Zap } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { QrCode } from '@/components/QrCode';
import { useLnurlLogin } from '@/hooks/useLnurlLogin';
import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { clearSession, loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Abbreviates a long hex key to `head…tail` for compact display.
 *
 * @param key - The full key.
 * @returns The shortened form.
 */
function shortenKey(key: string): string {
  return `${key.slice(0, 12)}…${key.slice(-8)}`;
}

/**
 * The LNURL-auth login surface.
 *
 * Shows the signed-in account when one is present, otherwise walks the visitor
 * through the login state machine (button → QR → success/expired/error). On
 * mount it rehydrates from a persisted token: a valid token logs the visitor
 * straight in, a rejected (401) token is cleared.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const { status, lnurl, start } = useLnurlLogin();

  useEffect(() => {
    const token = loadSession();
    if (token === null) {
      return;
    }
    fetchMe(token)
      .then((maybeAccount) => {
        if (maybeAccount === null) {
          clearSession();
        } else {
          setAuth(token, maybeAccount);
        }
      })
      .catch((error: unknown) => {
        // Fail loud, but never nuke a possibly-valid token on a transient error.
        console.error('Session hydration failed', error);
      });
  }, [setAuth]);

  let body: ReactElement;
  if (account !== null) {
    body = <LoggedInView account={account} onLogout={clearAuth} />;
  } else if (status === 'waiting' && lnurl !== null) {
    body = <QrView lnurl={lnurl} />;
  } else if (status === 'expired') {
    body = <ExpiredView onRetry={start} />;
  } else if (status === 'error') {
    body = <ErrorView onRetry={start} />;
  } else if (status === 'starting') {
    body = <StartingView />;
  } else {
    body = <StartView onStart={start} />;
  }

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      {body}
    </section>
  );
}

/** Props for {@link LoggedInView}. */
interface LoggedInViewProps {
  /** The signed-in account. */
  account: Account;
  /** Called when the visitor logs out. */
  onLogout: () => void;
}

/**
 * The signed-in state: role, a shortened linking key, and a log-out button.
 *
 * @param props - See {@link LoggedInViewProps}.
 * @returns The signed-in view.
 */
function LoggedInView({ account, onLogout }: LoggedInViewProps): ReactElement {
  return (
    <>
      <p className="text-xs uppercase tracking-widest text-neutral-400">Signed in</p>
      <p className="text-lg font-medium capitalize text-neutral-900">{account.role}</p>
      <p className="font-mono text-sm text-neutral-500" title={account.linkingKey}>
        {shortenKey(account.linkingKey)}
      </p>
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Log out
      </button>
    </>
  );
}

/** Props for {@link StartView}. */
interface StartViewProps {
  /** Called to begin the login flow. */
  onStart: () => void;
}

/**
 * The initial logged-out state: a single call-to-action.
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({ onStart }: StartViewProps): ReactElement {
  return (
    <>
      <Zap aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <h2 className="text-center text-lg font-medium text-neutral-900">Sign in to 21.gifts</h2>
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Zap aria-hidden="true" className="h-4 w-4" />
        Log in with your Lightning wallet
      </button>
    </>
  );
}

/**
 * The transient state between requesting and receiving a challenge.
 *
 * @returns The loading view.
 */
function StartingView(): ReactElement {
  return (
    <>
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />
      <p className="text-sm text-neutral-500">Preparing your login…</p>
    </>
  );
}

/** Props for {@link QrView}. */
interface QrViewProps {
  /** The LNURL to render and deep-link to. */
  lnurl: string;
}

/**
 * The waiting state: a scannable QR plus a wallet deep-link.
 *
 * The QR encodes the uppercased LNURL (denser QR); the deep-link keeps the
 * canonical casing so mobile wallets open on tap.
 *
 * @param props - See {@link QrViewProps}.
 * @returns The QR view.
 */
function QrView({ lnurl }: QrViewProps): ReactElement {
  return (
    <>
      <h2 className="text-center text-lg font-medium text-neutral-900">Scan to log in</h2>
      <QrCode value={lnurl.toUpperCase()} />
      <a
        href={`lightning:${lnurl}`}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Zap aria-hidden="true" className="h-4 w-4" />
        Open in wallet
      </a>
      <p className="text-center text-sm text-neutral-500">
        Scan with Wallet of Satoshi or tap to open your wallet
      </p>
    </>
  );
}

/** Props for {@link ExpiredView}. */
interface ExpiredViewProps {
  /** Called to restart the login flow. */
  onRetry: () => void;
}

/**
 * The expired state: the challenge lapsed (or was already used).
 *
 * @param props - See {@link ExpiredViewProps}.
 * @returns The expired view.
 */
function ExpiredView({ onRetry }: ExpiredViewProps): ReactElement {
  return (
    <>
      <Clock aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <p className="text-center text-sm text-neutral-500">Login expired</p>
      <RetryButton onRetry={onRetry} />
    </>
  );
}

/** Props for {@link ErrorView}. */
interface ErrorViewProps {
  /** Called to restart the login flow. */
  onRetry: () => void;
}

/**
 * The error state: a request failed or a response was malformed.
 *
 * @param props - See {@link ErrorViewProps}.
 * @returns The error view.
 */
function ErrorView({ onRetry }: ErrorViewProps): ReactElement {
  return (
    <>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <p className="text-center text-sm text-neutral-500">
        Something went wrong. Please try again.
      </p>
      <RetryButton onRetry={onRetry} />
    </>
  );
}

/** Props for {@link RetryButton}. */
interface RetryButtonProps {
  /** Called on click. */
  onRetry: () => void;
}

/**
 * A shared "Try again" button used by the expired and error states.
 *
 * @param props - See {@link RetryButtonProps}.
 * @returns The retry button.
 */
function RetryButton({ onRetry }: RetryButtonProps): ReactElement {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
    >
      Try again
    </button>
  );
}
