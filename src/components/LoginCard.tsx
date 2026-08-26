'use client';

import { AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The `/login` card: one Log in button, preparing, or error.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/address`, or `/welcome`.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const passkey = usePasskeyLogin();

  useEffect(() => {
    if (account !== null) {
      passkey.cancel();
    }
  }, [account, passkey.cancel]);

  let body: ReactElement;
  if (account !== null) {
    body = <StartingView />;
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
 * The transient state while a passkey ceremony is in flight or a redirect is pending.
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
