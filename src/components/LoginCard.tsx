'use client';

import { AlertTriangle, Fingerprint, Gift, Loader2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type ReactElement } from 'react';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { NameForm } from '@/components/NameForm';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { fetchMe } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The login surface: one Log in button, then name, address, and welcome.
 *
 * Shows the signed-in account when one is present. On mount it rehydrates
 * from a persisted token: a valid token logs the visitor straight in unless a
 * newer in-page session or logout already won; a rejected token calls
 * `clearAuth` when the in-memory session is absent or still that token.
 * Unmount and logout invalidate in-flight hydration. Logout and successful
 * hydration cancel an in-flight login ceremony.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const passkey = usePasskeyLogin();
  const hydrateGen = useRef(0);

  useEffect(() => {
    const token = loadSession();
    if (token === null) {
      return;
    }
    const gen = hydrateGen.current;
    fetchMe(token)
      .then((maybeAccount) => {
        if (gen !== hydrateGen.current) {
          return;
        }
        const current = useAuthStore.getState();
        if (loadSession() !== token) {
          return;
        }
        if (current.session !== null && current.session !== token) {
          return;
        }
        if (maybeAccount === null) {
          if (current.session === null || current.session === token) {
            clearAuth();
          }
          return;
        }
        if (current.session === token && current.account !== null) {
          return;
        }
        passkey.cancel();
        setAuth(token, maybeAccount);
      })
      .catch((error: unknown) => {
        console.error('Session hydration failed', error);
      });
    return (): void => {
      hydrateGen.current += 1;
    };
  }, [setAuth, clearAuth]);

  let body: ReactElement;
  if (account !== null) {
    body = (
      <LoggedInView
        account={account}
        onLogout={() => {
          hydrateGen.current += 1;
          passkey.cancel();
          clearAuth();
        }}
      />
    );
  } else if (passkey.status === 'starting') {
    body = <StartingView />;
  } else if (passkey.status === 'error') {
    body = <ErrorView onRetry={passkey.retry} />;
  } else {
    body = <StartView onLogin={passkey.login} />;
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
 * Whether the account has a display name to show.
 *
 * @param account - Signed-in account.
 * @returns True when `name` is a non-empty string.
 */
function hasDisplayName(account: Account): boolean {
  return account.name !== null && account.name.trim() !== '';
}

/**
 * Whether the account has a Wallet of Satoshi address to receive gifts.
 *
 * @param account - Signed-in account.
 * @returns True when `lightningAddress` is a non-empty string.
 */
function hasLightningAddress(account: Account): boolean {
  return account.lightningAddress !== null && account.lightningAddress.trim() !== '';
}

/**
 * The signed-in state: ask for a name, then an address, then welcome.
 *
 * @param props - See {@link LoggedInViewProps}.
 * @returns The signed-in view.
 */
function LoggedInView({ account, onLogout }: LoggedInViewProps): ReactElement {
  const { t } = useTranslations();
  const named = hasDisplayName(account);
  const linked = hasLightningAddress(account);
  const displayName = named ? (account.name as string) : '';

  let step: ReactElement;
  if (!named) {
    step = <NameForm />;
  } else if (!linked) {
    step = (
      <>
        <p className="text-sm text-neutral-500">{t('login.helloName', { name: displayName })}</p>
        <LightningAddressForm />
      </>
    );
  } else {
    step = (
      <>
        <WelcomeView name={displayName} />
        <NameForm />
        <LightningAddressForm />
      </>
    );
  }

  return (
    <>
      <p className="text-xs tracking-widest text-neutral-400 uppercase">{t('login.signedIn')}</p>
      {step}
      <button
        type="button"
        onClick={onLogout}
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        {t('login.logOut')}
      </button>
    </>
  );
}

/** Props for {@link WelcomeView}. */
interface WelcomeViewProps {
  /** Display name already saved on the account. */
  name: string;
}

/**
 * Shown once name and Wallet of Satoshi address are both saved.
 *
 * @param props - See {@link WelcomeViewProps}.
 * @returns The welcome block.
 */
function WelcomeView({ name }: WelcomeViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Gift aria-hidden="true" className="h-10 w-10 text-neutral-900" />
      <h2 className="text-center text-lg font-medium text-neutral-900">
        {t('login.welcomeHeading', { name })}
      </h2>
      <p className="text-center text-sm text-neutral-500">{t('login.welcomeBody')}</p>
      <Link
        href="/donate"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Gift aria-hidden="true" className="h-4 w-4" />
        {t('login.welcomeCta')}
      </Link>
    </>
  );
}

/** Props for {@link StartView}. */
interface StartViewProps {
  /** Called to sign in with an existing passkey, or create one. */
  onLogin: () => void;
}

/**
 * The initial logged-out state: a single Log in button.
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({ onLogin }: StartViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <h2 className="text-center text-lg font-medium text-neutral-900">{t('login.heading')}</h2>
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Fingerprint aria-hidden="true" className="h-4 w-4" />
        {t('login.submit')}
      </button>
    </>
  );
}

/**
 * The transient state while a passkey ceremony is in flight.
 *
 * @returns The loading view.
 */
function StartingView(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />
      <p className="text-sm text-neutral-500">{t('login.preparing')}</p>
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
  const { t } = useTranslations();
  return (
    <>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-neutral-400" />
      <p className="text-center text-sm text-neutral-500">{t('login.error')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        {t('login.retry')}
      </button>
    </>
  );
}
