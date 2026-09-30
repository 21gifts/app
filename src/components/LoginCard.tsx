'use client';

import { AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { WRONG_ACCOUNT_ERROR } from '@/lib/api';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { iosPasskeyBlock, type IosPasskeyBlock } from '@/lib/ios-passkey';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The `/login` card: Log in, account choice, unknown passkey, preparing,
 * error, or in-app browser escape.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/username`, `/setup/address`, `/setup/rules`,
 * or `/welcome`.
 *
 * @returns The card element.
 */
export function LoginCard(): ReactElement {
  const account = useAuthStore((state) => state.account);
  const wrongAccount = useAuthStore((state) => state.wrongAccount);
  const clearWrongAccount = useAuthStore((state) => state.clearWrongAccount);
  const passkey = usePasskeyLogin();
  const [inApp, setInApp] = useState(false);
  const [iosBlock, setIosBlock] = useState<IosPasskeyBlock | null>(null);

  useEffect(() => {
    setInApp(isInAppBrowser());
    setIosBlock(iosPasskeyBlock(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (account !== null) {
      passkey.cancel();
    }
  }, [account, passkey.cancel]);

  const wrongAccountHint = wrongAccount || passkey.error === WRONG_ACCOUNT_ERROR;

  let body: ReactElement;
  if (account !== null) {
    body = <StartingView />;
  } else if (inApp || passkey.status === 'unsupported') {
    body = <InAppBrowserView />;
  } else if (passkey.status === 'starting') {
    body = <StartingView />;
  } else if (wrongAccountHint || passkey.status === 'error') {
    body = (
      <ErrorView
        wrongAccount={wrongAccountHint}
        iosBlock={iosBlock}
        iosVersionError={passkey.error === 'login.iosVersion'}
        onRetry={() => {
          clearWrongAccount();
          if (wrongAccountHint) {
            passkey.login();
            return;
          }
          passkey.retry();
        }}
      />
    );
  } else if (passkey.status === 'unknown') {
    body = (
      <UnknownView
        iosBlock={iosBlock}
        onRegister={() => passkey.register()}
        onRetry={passkey.login}
      />
    );
  } else if (passkey.status === 'choice') {
    body = (
      <ChoiceView
        iosBlock={iosBlock}
        onAuthenticate={passkey.authenticate}
        onRegister={() => passkey.register()}
      />
    );
  } else {
    body = <StartView onLogin={passkey.login} iosBlock={iosBlock} />;
  }

  return <Card surface={false}>{body}</Card>;
}

/**
 * Installed iOS version when it is below the sign-in minimum. Hidden otherwise.
 *
 * @param props - Parsed block, or null.
 * @returns The info line, or null.
 */
function IosVersionNote({ block }: { block: IosPasskeyBlock | null }): ReactElement | null {
  const { t } = useTranslations();
  if (block === null) {
    return null;
  }
  return (
    <p role="status" className="text-center text-sm text-app-muted">
      {t('login.iosVersion', { version: block.installed, required: block.required })}
    </p>
  );
}

/** Props for {@link StartView}. */
interface StartViewProps {
  /** Called to start authenticate-first login. */
  onLogin: () => void;
  /** Old iOS notice, or null. */
  iosBlock: IosPasskeyBlock | null;
}

/**
 * The initial logged-out state: a single Log in button.
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({ onLogin, iosBlock }: StartViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.heading')}</h1>
      <IosVersionNote block={iosBlock} />
      <Button
        type="button"
        onClick={onLogin}
        icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}
      >
        {t('login.submit')}
      </Button>
    </>
  );
}

/** Props for {@link ChoiceView}. */
interface ChoiceViewProps {
  /** Authenticate only; never falls through to register. */
  onAuthenticate: () => void;
  /** Create a passkey with no view key. */
  onRegister: () => void;
  /** Old iOS notice, or null. */
  iosBlock: IosPasskeyBlock | null;
}

/**
 * After login `NotAllowedError`: ask whether the visitor already has an account.
 *
 * @param props - See {@link ChoiceViewProps}.
 * @returns The choice view.
 */
function ChoiceView({ onAuthenticate, onRegister, iosBlock }: ChoiceViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.choiceHeading')}</h1>
      <IosVersionNote block={iosBlock} />
      <Button
        type="button"
        onClick={onAuthenticate}
        icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}
      >
        {t('login.existing')}
      </Button>
      <Button type="button" variant="secondary" onClick={onRegister}>
        {t('login.create')}
      </Button>
    </>
  );
}

/** Props for {@link UnknownView}. */
interface UnknownViewProps {
  /** Create a passkey with no view key. */
  onRegister: () => void;
  /** Authenticate-first login; never creates an account. */
  onRetry: () => void;
  /** Old iOS notice, or null. */
  iosBlock: IosPasskeyBlock | null;
}

/**
 * After authenticate finish `Unknown credential`: the offered passkey is not an account.
 * **Open a new account** creates; **Try again** calls login.
 *
 * @param props - See {@link UnknownViewProps}.
 * @returns The unknown-credential view.
 */
function UnknownView({ onRegister, onRetry, iosBlock }: UnknownViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-lg font-medium text-center text-app-fg">{t('login.unknownHeading')}</h1>
      <p className="text-sm text-app-muted text-center">{t('login.unknownBody')}</p>
      <IosVersionNote block={iosBlock} />
      <Button type="button" onClick={onRegister}>
        {t('login.create')}
      </Button>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t('login.retry')}
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
  /** When true, show the dedicated wrong-account copy instead of `login.error`. */
  wrongAccount: boolean;
  /** Old iOS notice, or null. */
  iosBlock: IosPasskeyBlock | null;
  /** When true, the alert is the installed-version sentence. */
  iosVersionError: boolean;
}

/**
 * The error state: a request failed, a response was malformed, or the visitor
 * signed in with an account whose session is refused.
 *
 * @param props - See {@link ErrorViewProps}.
 * @returns The error view.
 */
function ErrorView({
  onRetry,
  wrongAccount,
  iosBlock,
  iosVersionError,
}: ErrorViewProps): ReactElement {
  const { t } = useTranslations();
  const alert = wrongAccount
    ? t('login.wrongAccount')
    : iosVersionError && iosBlock !== null
      ? t('login.iosVersion', { version: iosBlock.installed, required: iosBlock.required })
      : t('login.error');
  return (
    <>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <p role="alert" className="text-center text-sm text-app-danger">
        {alert}
      </p>
      {iosVersionError ? null : <IosVersionNote block={iosBlock} />}
      <Button type="button" onClick={onRetry}>
        {t('login.retry')}
      </Button>
    </>
  );
}
