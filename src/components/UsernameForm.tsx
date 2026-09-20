'use client';

import { Loader2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { setUsername } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lets a signed-in visitor choose the unique \@21.gifts username.
 *
 * @param props - Optional `onSaved` after a successful POST.
 * @returns The username field and Continue control.
 */
export function UsernameForm({ onSaved }: { onSaved?: () => void } = {}): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'empty' | 'invalid' | 'taken' | 'request' | null>(null);
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
      const account = await setUsername(session, value);
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

  return (
    <form className="mt-8 flex flex-col gap-3" onSubmit={onSubmit}>
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
        className="rounded-lg border border-app-border bg-transparent px-3 py-2 font-mono text-sm text-app-fg"
        aria-invalid={error !== null}
      />
      {error !== null ? (
        <p role="status" className="text-center text-sm text-app-danger">
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
      <Button type="submit" disabled={busy}>
        {busy ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          t('setup.continue')
        )}
      </Button>
    </form>
  );
}
