'use client';

import { Loader2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { AppShellFooter } from '@/components/AppShell';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { setUsername } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lets a signed-in visitor choose the unique \@21.gifts username.
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
  const [error, setError] = useState<'empty' | 'invalid' | 'taken' | 'request' | null>(null);
  const formId = useId();
  const fieldId = useId();

  const onSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (session === null) {
      return;
    }
    const value = draft.trim().toLowerCase();
    if (value === '') {
      setError('empty');
      return;
    }
    setBusy(true);
    setError(null);
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
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (message === 'username-taken') {
        setError('taken');
      } else if (message === 'username-invalid') {
        setError('invalid');
      } else {
        setError('request');
      }
    } finally {
      setBusy(false);
    }
  };

  const continueButton = (
    <Button
      type="submit"
      form={variant === 'onboarding' ? formId : undefined}
      size="lg"
      disabled={busy}
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
          setError(null);
        }}
        disabled={busy}
        className="w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 font-mono text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50"
        aria-invalid={error !== null}
      />
      {error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(
            error === 'empty'
              ? 'setup.usernameEmpty'
              : error === 'taken'
                ? 'setup.usernameTaken'
                : error === 'invalid'
                  ? 'setup.usernameInvalid'
                  : 'setup.usernameRequest',
          )}
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
