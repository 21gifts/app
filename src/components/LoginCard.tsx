'use client';

import { AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The `/login` card: Log in, preparing, error, or in-app browser escape.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/address`, `/setup/rules`, or `/welcome`.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const passkey = usePasskeyLogin();
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  useEffect(() => {
    if (account !== null) {
      passkey.cancel();
    }
  }, [account, passkey.cancel]);

  let body: ReactElement;
  if (account !== null) {
    body = <StartingView />;
  } else if (inApp || passkey.status === 'unsupported') {
    body = <InAppBrowserView />;
  } else if (passkey.status === 'starting') {
    body = <StartingView />;
  } else if (passkey.status === 'error') {
    body = <ErrorView onRetry={passkey.retry} />;
  } else {
    body = <StartView onLogin={passkey.login} />;
  }

  return <Card>{body}</Card>;
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
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.heading')}</h1>
      <Button type="button" onClick={onLogin} icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}>
        {t('login.submit')}
      </Button>
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
      <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
      <p className="text-sm text-app-muted">{t('login.preparing')}</p>
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
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <p className="text-center text-sm text-app-muted">{t('login.error')}</p>
      <Button type="button" onClick={onRetry}>
        {t('login.retry')}
      </Button>
    </>
  );
}
