'use client';

import { Loader2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { AppShellFooter } from '@/components/AppShell';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { setUsername } from '@/lib/api';
import {
  USERNAME_FORMAT_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
  usernameProblem,
} from '@/lib/profile-fields';
import { useAuthStore } from '@/stores/auth-store';

/** Server rejection kept after a username save, separate from the live rule. */
type UsernameServer = 'taken' | 'invalid' | 'request';

/**
 * Maps a username save rejection onto the field.
 *
 * Accepts the legacy status codes and the exact api sentences.
 *
 * @param caught - Rejection from {@link setUsername}.
 * @returns `taken`, `invalid`, or `request` for anything else.
 */
function usernameFailure(caught: unknown): UsernameServer {
  const message = caught instanceof Error ? caught.message : '';
  if (message === 'username-taken' || message === USERNAME_TAKEN_MESSAGE) {
    return 'taken';
  }
  if (message === 'username-invalid' || message === USERNAME_FORMAT_MESSAGE) {
    return 'invalid';
  }
  return 'request';
}

/**
 * Lets a signed-in visitor choose the unique \@21.gifts username.
 *
 * An untouched field stays quiet. After a change, blur, or submit, an empty or
 * badly shaped handle is shown under the field and Continue is disabled. A
 * taken or rejected handle stays under the field and Continue stays disabled
 * until the draft changes. An unknown save failure stays under the field and
 * leaves Continue enabled.
 *
 * @param props - `onboarding` shows the field at the top and **Continue** in
 *   `AppShellFooter`; `overlay` keeps **Continue** in the form. There is no Skip.
 *   Defaults to `onboarding`. Optional `onSaved` after a successful POST.
 * @returns The username field and Continue control.
 */
export function UsernameForm({
  variant = 'onboarding',
  onSaved,
}: { variant?: 'onboarding' | 'overlay'; onSaved?: () => void } = {}): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [server, setServer] = useState<UsernameServer | null>(null);
  const formId = useId();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const problem = usernameProblem(draft);
  const clientVisible = touched && problem !== null;
  const serverBlocks = server === 'taken' || server === 'invalid';
  let messageKey:
    | 'setup.usernameEmpty'
    | 'setup.usernameInvalid'
    | 'setup.usernameTaken'
    | 'setup.usernameRequest'
    | null = null;
  if (clientVisible) {
    messageKey = problem === 'empty' ? 'setup.usernameEmpty' : 'setup.usernameInvalid';
  } else if (server === 'taken') {
    messageKey = 'setup.usernameTaken';
  } else if (server === 'invalid') {
    messageKey = 'setup.usernameInvalid';
  } else if (server === 'request') {
    messageKey = 'setup.usernameRequest';
  }

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setTouched(true);
    if (usernameProblem(draft) !== null) {
      return;
    }
    if (session === null) {
      return;
    }
    const value = draft.trim().toLowerCase();
    setBusy(true);
    setServer(null);
    try {
      const account = await setUsername(
        session,
        value,
        variant === 'onboarding' ? 'setup' : 'enforce',
      );
      /* v8 ignore next 3 -- unmount/logout while the POST is in flight */
      if (useAuthStore.getState().session !== session) {
        return;
      }
      setAccount(account);
      onSaved?.();
    } catch (caught: unknown) {
      setServer(usernameFailure(caught));
    } finally {
      setBusy(false);
    }
  };

  const continueButton = (
    <Button
      type="submit"
      form={variant === 'onboarding' ? formId : undefined}
      size="lg"
      disabled={busy || clientVisible || serverBlocks}
      icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
    >
      {t('setup.continue')}
    </Button>
  );

  const form = (
    <form id={formId} className="mt-6 flex w-full flex-col items-stretch gap-3" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor={fieldId}>
        {t('setup.usernameTitle')}
      </label>
      <input
        id={fieldId}
        autoCapitalize="off"
        autoComplete="username"
        autoCorrect="off"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setTouched(true);
          setServer(null);
        }}
        onBlur={() => {
          setTouched(true);
        }}
        disabled={busy}
        {...(messageKey !== null
          ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
          : {})}
        className="w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 font-mono text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50"
      />
      {messageKey !== null ? (
        <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
          {t(messageKey)}
        </p>
      ) : null}
      {variant === 'onboarding' ? (
        <AppShellFooter>
          <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-3">
            {continueButton}
          </div>
        </AppShellFooter>
      ) : (
        continueButton
      )}
    </form>
  );
  if (variant === 'onboarding') {
    return form;
  }
  return <SundayWritingGate>{form}</SundayWritingGate>;
}
