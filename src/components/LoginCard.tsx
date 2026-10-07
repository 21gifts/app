'use client';

import { AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, Field } from '@/components/ui';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { WRONG_ACCOUNT_ERROR } from '@/lib/api';
import { androidPasskeyBlock } from '@/lib/android-passkey';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { iosPasskeyBlock } from '@/lib/ios-passkey';
import { useAuthStore } from '@/stores/auth-store';

/** `usePasskeyLogin` error when the new passkey returned no PRF output. */
const PRF_UNSUPPORTED_ERROR = 'wallet.prfUnsupported';

/** Installed OS version below the sign-in minimum, plus which sentence to show. */
type VersionBlock = {
  installed: string;
  required: string;
  messageKey: 'login.iosVersion' | 'login.androidVersion';
};

/**
 * The `/login` card: Log in, account choice, unknown passkey, name,
 * preparing, error, or in-app browser escape.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/username`, `/setup/rules`,
 * or `/welcome`.
 *
 * @param props - `footer`: shown under the card only while no login or
 *   sign-up is running and nobody is signed in (`WalletLoginCard` puts
 *   **Log out** there, so it cannot race a login in flight).
 * @returns The card, followed by `footer` when one is given and shown.
 */
export function LoginCard({ footer }: { footer?: ReactNode } = {}): ReactElement {
  const account = useAuthStore((state) => state.account);
  const wrongAccount = useAuthStore((state) => state.wrongAccount);
  const clearWrongAccount = useAuthStore((state) => state.clearWrongAccount);
  const passkey = usePasskeyLogin();
  const [inApp, setInApp] = useState(false);
  const [versionBlock, setVersionBlock] = useState<VersionBlock | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);

  useEffect(() => {
    setInApp(isInAppBrowser());
    const ios = iosPasskeyBlock(navigator.userAgent);
    if (ios !== null) {
      setVersionBlock({ ...ios, messageKey: 'login.iosVersion' });
      return;
    }
    const android = androidPasskeyBlock(navigator.userAgent);
    if (android !== null) {
      setVersionBlock({ ...android, messageKey: 'login.androidVersion' });
      return;
    }
    setVersionBlock(null);
  }, []);

  useEffect(() => {
    if (account !== null) {
      passkey.cancel();
    }
  }, [account, passkey.cancel]);

  const wrongAccountHint = wrongAccount || passkey.error === WRONG_ACCOUNT_ERROR;
  const versionErrorKey =
    passkey.error === 'login.iosVersion' || passkey.error === 'login.androidVersion'
      ? passkey.error
      : null;
  const prfUnsupported = passkey.error === PRF_UNSUPPORTED_ERROR;

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
        versionBlock={versionBlock}
        versionErrorKey={versionErrorKey}
        prfUnsupported={prfUnsupported}
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
  } else if (passkey.status === 'name') {
    body = (
      <NameView
        draft={nameDraft}
        error={nameInvalid ? 'invalid' : passkey.nameError}
        onDraftChange={(value) => {
          setNameDraft(value);
          setNameInvalid(false);
        }}
        onSubmit={() => {
          if (nameDraft.trim() === '') {
            setNameInvalid(true);
            return;
          }
          setNameInvalid(false);
          passkey.submitName(nameDraft);
        }}
      />
    );
  } else if (passkey.status === 'unknown') {
    body = (
      <UnknownView
        versionBlock={versionBlock}
        onRegister={() => passkey.register()}
        onRetry={passkey.login}
      />
    );
  } else if (passkey.status === 'choice') {
    body = (
      <ChoiceView
        versionBlock={versionBlock}
        onAuthenticate={passkey.authenticate}
        onRegister={() => passkey.register()}
      />
    );
  } else {
    body = (
      <StartView
        onLogin={passkey.login}
        onRegister={() => passkey.register()}
        versionBlock={versionBlock}
      />
    );
  }

  const card = <Card surface={false}>{body}</Card>;
  if (footer === undefined || account !== null || passkey.status === 'starting') {
    return card;
  }
  return (
    <>
      {card}
      {footer}
    </>
  );
}

/**
 * Installed OS version when it is below the sign-in minimum. Hidden otherwise.
 *
 * @param props - Parsed block, or null.
 * @returns The info line, or null.
 */
function VersionNote({ block }: { block: VersionBlock | null }): ReactElement | null {
  const { t } = useTranslations();
  if (block === null) {
    return null;
  }
  return (
    <p role="status" className="text-center text-sm text-app-muted">
      {t(block.messageKey, { version: block.installed, required: block.required })}
    </p>
  );
}

/** Props for {@link StartView}. */
interface StartViewProps {
  /** Called to start authenticate-first login. */
  onLogin: () => void;
  /** Open the name form; does not start create. */
  onRegister: () => void;
  /** Old OS notice, or null. */
  versionBlock: VersionBlock | null;
}

/**
 * The initial logged-out state: **Log in**, then **Open a new account** under a short line.
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({ onLogin, onRegister, versionBlock }: StartViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.heading')}</h1>
      <VersionNote block={versionBlock} />
      <Button
        type="button"
        onClick={onLogin}
        icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}
      >
        {t('login.submit')}
      </Button>
      <p className="text-center text-sm text-app-muted">{t('login.newHere')}</p>
      <Button type="button" variant="secondary" onClick={onRegister}>
        {t('login.create')}
      </Button>
    </>
  );
}

/** Props for {@link ChoiceView}. */
interface ChoiceViewProps {
  /** Authenticate only; never falls through to register. */
  onAuthenticate: () => void;
  /** Open the name form; does not start create. */
  onRegister: () => void;
  /** Old OS notice, or null. */
  versionBlock: VersionBlock | null;
}

/**
 * After login `NotAllowedError`: ask whether the visitor already has an account.
 *
 * @param props - See {@link ChoiceViewProps}.
 * @returns The choice view.
 */
function ChoiceView({ onAuthenticate, onRegister, versionBlock }: ChoiceViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.choiceHeading')}</h1>
      <VersionNote block={versionBlock} />
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
  /** Open the name form; does not start create. */
  onRegister: () => void;
  /** Authenticate-first login; never creates an account. */
  onRetry: () => void;
  /** Old OS notice, or null. */
  versionBlock: VersionBlock | null;
}

/**
 * After authenticate finish `Unknown credential`: the offered passkey is not an account.
 * **Open a new account** opens the name form; **Try again** calls login.
 *
 * @param props - See {@link UnknownViewProps}.
 * @returns The unknown-credential view.
 */
function UnknownView({ onRegister, onRetry, versionBlock }: UnknownViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-lg font-medium text-center text-app-fg">{t('login.unknownHeading')}</h1>
      <p className="text-sm text-app-muted text-center">{t('login.unknownBody')}</p>
      <VersionNote block={versionBlock} />
      <Button type="button" onClick={onRegister}>
        {t('login.create')}
      </Button>
      <Button type="button" variant="secondary" onClick={onRetry}>
        {t('login.retry')}
      </Button>
    </>
  );
}

/** Props for {@link NameView}. */
interface NameViewProps {
  /** Current typed name. */
  draft: string;
  /** Shown under the field when set. */
  error: 'invalid' | 'taken' | null;
  /** Called when the field changes. */
  onDraftChange: (value: string) => void;
  /** Called to submit a non-empty draft. */
  onSubmit: () => void;
}

/**
 * Name form before a new-account create ceremony.
 *
 * @param props - See {@link NameViewProps}.
 * @returns The name view.
 */
function NameView({ draft, error, onDraftChange, onSubmit }: NameViewProps): ReactElement {
  const { t } = useTranslations();

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.nameHeading')}</h1>
      <p className="text-sm text-app-muted text-center">{t('login.nameBody')}</p>
      <form className="flex w-full flex-col items-stretch gap-3" onSubmit={handleSubmit}>
        <Field
          label={t('login.nameLabel')}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={32}
          value={draft}
          aria-invalid={error !== null}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
        />
        {error !== null ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(error === 'taken' ? 'login.nameTaken' : 'login.nameInvalid')}
          </p>
        ) : null}
        <Button type="submit">{t('login.nameSubmit')}</Button>
      </form>
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
  /** Old OS notice, or null. */
  versionBlock: VersionBlock | null;
  /** Version-error message key when the alert should be that sentence. */
  versionErrorKey: 'login.iosVersion' | 'login.androidVersion' | null;
  /** When true, the new passkey cannot hold a wallet on this phone or browser. */
  prfUnsupported: boolean;
}

/**
 * The error state: a request failed, a response was malformed, the visitor
 * signed in with an account whose session is refused, or the new passkey
 * cannot hold a wallet on this phone or browser (no PRF output).
 *
 * @param props - See {@link ErrorViewProps}.
 * @returns The error view.
 */
function ErrorView({
  onRetry,
  wrongAccount,
  versionBlock,
  versionErrorKey,
  prfUnsupported,
}: ErrorViewProps): ReactElement {
  const { t } = useTranslations();
  const matchingBlock =
    versionErrorKey !== null && versionBlock !== null && versionBlock.messageKey === versionErrorKey
      ? versionBlock
      : null;
  const alert = wrongAccount
    ? t('login.wrongAccount')
    : prfUnsupported
      ? t('wallet.prfUnsupported')
      : matchingBlock !== null
        ? t(matchingBlock.messageKey, {
            version: matchingBlock.installed,
            required: matchingBlock.required,
          })
        : t('login.error');
  return (
    <>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <p role="alert" className="text-center text-sm text-app-danger">
        {alert}
      </p>
      {versionErrorKey !== null ? null : <VersionNote block={versionBlock} />}
      <Button type="button" onClick={onRetry}>
        {t('login.retry')}
      </Button>
    </>
  );
}
