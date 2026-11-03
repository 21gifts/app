'use client';

import { AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { InAppBrowserView } from '@/components/InAppBrowserView';
import { LoginBlockedNotice } from '@/components/LoginBlockedNotice';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, ButtonLink, Card, Field } from '@/components/ui';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { WRONG_ACCOUNT_ERROR } from '@/lib/api';
import { androidPasskeyBlock } from '@/lib/android-passkey';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { iosPasskeyBlock } from '@/lib/ios-passkey';
import { usernameProblem } from '@/lib/profile-fields';
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
 * preparing, error, logins closed, new version ready, or in-app browser escape.
 *
 * When the api refuses to create a session because operators closed logins
 * (`logins_closed`) or this tab runs an older build (`app_outdated`), the card
 * shows {@link LoginBlockedNotice} instead of every other view, also over a
 * held-back session (that session stays held).
 *
 * While a stored session is held back (`lockedSession`), the start view is
 * the same, with **Welcome back, {name}** above the heading when the account
 * has a name or username, and **Confirm to open your wallet** directly above
 * **Log in**. **Log in** is then one passkey prompt
 * (authenticate only): whichever passkey answers decides the account, so a
 * different account replaces the held session. A dismissed prompt, an
 * unknown passkey, or any other failure of that prompt stays on this start
 * view with **Something went wrong. Please try again.** (`login.error`)
 * above **Log in**; a refused account (the wrong-account 403) shows
 * `login.wrongAccount` there instead and keeps the held session. Only this
 * held start view adds **Open a new account** under **New to 21.gifts?**: it
 * is registration, and a new account replaces the held session as well.
 *
 * **Recover account via Social Recovery**, a link to `/recover`, only comes
 * with a login problem, like **Open a new account**: the account question and
 * the unknown-passkey view offer it unless `showRecover` is false (inside
 * {@link WalletLoginCard}, which stands in for a member session). The idle
 * start view and the held start view do not offer it. A passkey of a social
 * recovery that is not finished yet (it belongs to that recovery, not to a
 * held session) shows `login.recoveryPending` with that link under the button
 * wherever it answered: on the error view under **Try again**, and on the held
 * start view under **Log in**, in place of `login.error`.
 *
 * After a successful login, {@link OnboardingGate} sends the visitor to
 * `/setup/name`, `/setup/username`, `/setup/rules`,
 * or `/welcome`.
 *
 * @param props - `heldProblem`: why the last wallet open of the held-back
 *   session failed (`noPrf` shows `wallet.prfUnsupported`, `failed` shows
 *   `login.error`), shown on the held start view until its next **Log in**.
 *   `showRecover`: whether the problem views (account question, unknown
 *   passkey) offer the Social Recovery entry (default `true`); an unfinished
 *   recovery always offers it.
 * @returns The card.
 */
export function LoginCard({
  heldProblem = null,
  showRecover = true,
}: { heldProblem?: 'noPrf' | 'failed' | null; showRecover?: boolean } = {}): ReactElement {
  const account = useAuthStore((state) => state.account);
  const lockedSession = useAuthStore((state) => state.lockedSession);
  const lockedName = useAuthStore((state) => state.lockedName);
  const wrongAccount = useAuthStore((state) => state.wrongAccount);
  const clearWrongAccount = useAuthStore((state) => state.clearWrongAccount);
  const passkey = usePasskeyLogin();
  const [inApp, setInApp] = useState(false);
  const [versionBlock, setVersionBlock] = useState<VersionBlock | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  // The held start view's Log in ended without a session (dismissed or failed).
  const [heldTried, setHeldTried] = useState(false);

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
      setHeldTried(false);
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
  } else if (passkey.status === 'closed' || passkey.status === 'outdated') {
    body = <LoginBlockedNotice kind={passkey.status} />;
  } else if (
    lockedSession !== null &&
    passkey.status !== 'name' &&
    (heldTried || passkey.status === 'idle')
  ) {
    body = (
      <StartView
        held
        showRecover={!wrongAccountHint && passkey.recoveryPending}
        greeting={lockedName}
        alert={
          wrongAccountHint
            ? 'login.wrongAccount'
            : passkey.recoveryPending
              ? 'login.recoveryPending'
              : heldTried || heldProblem === 'failed'
                ? 'login.error'
                : heldProblem === 'noPrf'
                  ? 'wallet.prfUnsupported'
                  : null
        }
        onLogin={() => {
          clearWrongAccount();
          setHeldTried(true);
          passkey.authenticate();
        }}
        onRegister={() => {
          setHeldTried(false);
          passkey.register();
        }}
        versionBlock={versionBlock}
      />
    );
  } else if (wrongAccountHint || passkey.status === 'error') {
    body = (
      <ErrorView
        wrongAccount={wrongAccountHint}
        versionBlock={versionBlock}
        versionErrorKey={versionErrorKey}
        prfUnsupported={prfUnsupported}
        recoveryPending={passkey.recoveryPending}
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
        error={passkey.nameError}
        onDraftChange={(value) => {
          setNameDraft(value);
          passkey.clearNameError();
        }}
        onSubmit={() => {
          passkey.submitName(nameDraft);
        }}
      />
    );
  } else if (passkey.status === 'unknown') {
    body = (
      <UnknownView
        versionBlock={versionBlock}
        showRecover={showRecover}
        onRegister={() => passkey.register()}
        onRetry={passkey.login}
      />
    );
  } else if (passkey.status === 'choice') {
    body = (
      <ChoiceView
        versionBlock={versionBlock}
        showRecover={showRecover}
        onAuthenticate={passkey.authenticate}
        onRegister={() => passkey.register()}
      />
    );
  } else {
    body = <StartView onLogin={passkey.login} versionBlock={versionBlock} />;
  }

  return <Card surface={false}>{body}</Card>;
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
  /** Open the name form; does not start create. Held start view only, else null. */
  onRegister?: (() => void) | null;
  /** Old OS notice, or null. */
  versionBlock: VersionBlock | null;
  /** Held-back member to greet (**Welcome back, {name}**), or null. */
  greeting?: string | null;
  /** True for a held-back session: **Confirm to open your wallet** above **Log in**. */
  held?: boolean;
  /** Alert above **Log in**, or null. */
  alert?:
    'login.error' | 'login.wrongAccount' | 'login.recoveryPending' | 'wallet.prfUnsupported' | null;
  /**
   * Whether **Recover account via Social Recovery** follows **Log in**: only a
   * held view with an unfinished recovery passes true; the idle view never
   * offers the entry.
   */
  showRecover?: boolean;
}

/**
 * **Recover account via Social Recovery**: a secondary link to `/recover`.
 *
 * @returns The link.
 */
function RecoverLink(): ReactElement {
  const { t } = useTranslations();
  return (
    <ButtonLink href="/recover" variant="secondary">
      {t('recover.entry')}
    </ButtonLink>
  );
}

/**
 * The initial logged-out state: **Log in**.
 * For a held-back session, a greeting above the heading, an alert,
 * **Confirm to open your wallet** above **Log in**, **Open a new account**
 * under a short line, and **Recover account via Social Recovery** only while
 * that alert says a recovery is not finished yet (`showRecover`).
 *
 * @param props - See {@link StartViewProps}.
 * @returns The start view.
 */
function StartView({
  onLogin,
  onRegister = null,
  versionBlock,
  greeting = null,
  held = false,
  alert = null,
  showRecover = false,
}: StartViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      {greeting === null ? null : (
        <p className="text-center text-sm text-app-muted">
          {t('login.heldGreeting', { name: greeting })}
        </p>
      )}
      <h1 className="text-center text-lg font-medium text-app-fg">{t('login.heading')}</h1>
      <VersionNote block={versionBlock} />
      {alert === null ? null : (
        <p role="alert" className="max-w-sm text-center text-sm text-app-danger">
          {t(alert)}
        </p>
      )}
      {held ? <p className="text-center text-sm text-app-muted">{t('login.heldConfirm')}</p> : null}
      <Button
        type="button"
        onClick={onLogin}
        icon={<Fingerprint aria-hidden="true" className="h-4 w-4" />}
      >
        {t('login.submit')}
      </Button>
      {showRecover ? <RecoverLink /> : null}
      {onRegister === null ? null : (
        <>
          <p className="text-center text-sm text-app-muted">{t('login.newHere')}</p>
          <Button type="button" variant="secondary" onClick={onRegister}>
            {t('login.create')}
          </Button>
        </>
      )}
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
  /** Whether **Recover account via Social Recovery** is the third control. */
  showRecover: boolean;
}

/**
 * After login `NotAllowedError`: ask whether the visitor already has an
 * account, with **Recover account via Social Recovery** as the third control
 * when `showRecover` is set.
 *
 * @param props - See {@link ChoiceViewProps}.
 * @returns The choice view.
 */
function ChoiceView({
  onAuthenticate,
  onRegister,
  versionBlock,
  showRecover,
}: ChoiceViewProps): ReactElement {
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
      {showRecover ? <RecoverLink /> : null}
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
  /** Whether **Recover account via Social Recovery** follows the two buttons. */
  showRecover: boolean;
}

/**
 * After authenticate finish `Unknown credential`: the offered passkey is not an account.
 * **Try again** (the first control) calls login; secondary **Open a new account**
 * opens the name form; **Recover account via Social Recovery** follows them when
 * `showRecover` is set, because this view only appears after a login problem.
 *
 * @param props - See {@link UnknownViewProps}.
 * @returns The unknown-credential view.
 */
function UnknownView({
  onRegister,
  onRetry,
  versionBlock,
  showRecover,
}: UnknownViewProps): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Fingerprint aria-hidden="true" className="h-8 w-8 text-app-subtle" />
      <h1 className="text-lg font-medium text-center text-app-fg">{t('login.unknownHeading')}</h1>
      <p className="text-sm text-app-muted text-center">{t('login.unknownBody')}</p>
      <VersionNote block={versionBlock} />
      <Button type="button" onClick={onRetry}>
        {t('login.retry')}
      </Button>
      <Button type="button" variant="secondary" onClick={onRegister}>
        {t('login.create')}
      </Button>
      {showRecover ? <RecoverLink /> : null}
    </>
  );
}

/** Props for {@link NameView}. */
interface NameViewProps {
  /** Current typed name. */
  draft: string;
  /** Server username problem from the passkey hook, or null. */
  error: 'invalid' | 'taken' | null;
  /** Called when the field changes. */
  onDraftChange: (value: string) => void;
  /** Called when the draft is a valid username. */
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
  const [touched, setTouched] = useState(false);
  const problem = usernameProblem(draft);
  const clientBroken = touched && problem !== null;
  const serverBroken = error === 'taken' || error === 'invalid';
  const message = clientBroken
    ? t('login.nameInvalid')
    : error === 'taken'
      ? t('login.nameTaken')
      : error === 'invalid'
        ? t('login.nameInvalid')
        : undefined;

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    setTouched(true);
    if (usernameProblem(draft) !== null) {
      return;
    }
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
          value={draft}
          {...(message === undefined ? {} : { error: message, errorAnnounce: true })}
          onChange={(event) => {
            onDraftChange(event.target.value);
            setTouched(true);
          }}
          onBlur={() => {
            setTouched(true);
          }}
        />
        <Button type="submit" disabled={clientBroken || serverBroken}>
          {t('login.nameSubmit')}
        </Button>
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
  /**
   * When true, the passkey belongs to a social recovery that is not finished
   * yet: **Recover account via Social Recovery** follows **Try again**.
   */
  recoveryPending: boolean;
}

/**
 * The error state: a request failed, a response was malformed, the visitor
 * signed in with an account whose session is refused, the new passkey
 * cannot hold a wallet on this phone or browser (no PRF output), or the
 * passkey belongs to a social recovery that is not finished yet. That last
 * alert names **Recover account via Social Recovery**, so the link always
 * follows **Try again**: Try again asks the same passkey, which the api
 * refuses the same way until the recovery is finished.
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
  recoveryPending,
}: ErrorViewProps): ReactElement {
  const { t } = useTranslations();
  const pending = !wrongAccount && recoveryPending;
  const matchingBlock =
    versionErrorKey !== null && versionBlock !== null && versionBlock.messageKey === versionErrorKey
      ? versionBlock
      : null;
  const alert = wrongAccount
    ? t('login.wrongAccount')
    : pending
      ? t('login.recoveryPending')
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
      {pending ? <RecoverLink /> : null}
    </>
  );
}
