'use client';

import { AlertTriangle, Fingerprint, Loader2, LogOut } from 'lucide-react';
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
 * The login surface: one Log in button, then signed-in account.
 *
 * Shows the signed-in account when one is present. On mount it rehydrates
 * from a persisted token: a valid token logs the visitor straight in unless a
 * newer in-page session or logout already won; a rejected token calls
 * `clearAuth` when the in-memory session is absent or still that token.
 * Unmount and logout invalidate in-flight hydration. Logout and successful
 * hydration cancel an in-flight passkey ceremony.
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
 * The signed-in state: role, name form, address form, and a log-out button.
 *
 * @param props - See {@link LoggedInViewProps}.
 * @returns The signed-in view.
 */
function LoggedInView({ account, onLogout }: LoggedInViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <p className="text-xs tracking-widest text-neutral-400 uppercase">{t('login.signedIn')}</p>
      <p className="text-lg font-medium text-neutral-900 capitalize">{account.role}</p>
      <NameForm />
      <LightningAddressForm />
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
