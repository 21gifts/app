'use client';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { setName } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { hasDisplayName } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/** Validation or request failure shown on the name form. */
type NameError = { type: 'empty' } | { type: 'request' };

/**
 * Lets a signed-in giver set or edit the display name shown on their account.
 *
 * Reads the current account and session token from the auth store and merges
 * the saved `name` into that account so a concurrent address write is not
 * overwritten. Renders nothing when no account — or, defensively, no session
 * token — is present, since it is only mounted inside the logged-in view.
 *
 * Treats a missing or whitespace-only name the same as `hasDisplayName`: the
 * prompt and input stay up until a non-empty trimmed name is saved.
 *
 * @param props - `onboarding` shows the field at the top and **Continue** at
 *   the bottom of the screen; `profile` uses icon actions to the right of the
 *   field. Defaults from whether a name is already saved.
 * @returns The name section, or `null` when there is nothing to show.
 */
export function NameForm(props: { variant?: 'onboarding' | 'profile' } = {}): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<NameError | null>(null);

  if (account === null || session === null) {
    return null;
  }

  const name = account.name;
  const named = hasDisplayName(account);
  const variant = props.variant ?? (named ? 'profile' : 'onboarding');

  /**
   * Runs an api action with shared busy/error handling and a stale-session guard.
   *
   * @param action - The api call to run with the session token.
   * @param onFresh - Called with the result only if the session is still the
   * one that started the request.
   */
  const runGuarded = async (
    action: (token: string) => Promise<Account>,
    onFresh: (result: Account) => void,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await action(session);
      if (useAuthStore.getState().session !== session) {
        return;
      }
      onFresh(result);
    } catch {
      setError({ type: 'request' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError({ type: 'empty' });
      return;
    }
    void runGuarded(
      (token) => setName(token, trimmed),
      (updated) => {
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        // Keep fields this form does not own so a concurrent address save
        // is not overwritten by a stale full-account response.
        setAccount({ ...current, name: updated.name });
        setEditing(false);
      },
    );
  };

  const submitIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  if (variant === 'onboarding') {
    return (
      <form
        onSubmit={handleSubmit}
        className="mt-6 flex w-full flex-1 flex-col items-stretch gap-3"
      >
        <p className="text-center text-sm text-app-muted">{t('name.prompt')}</p>
        <input
          type="text"
          autoComplete="name"
          spellCheck={false}
          placeholder={t('name.placeholder')}
          aria-label={t('name.aria')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
          className="w-full rounded-2xl border border-app-border-strong px-4 py-2 text-sm text-app-fg transition disabled:opacity-50"
        />
        {error !== null ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {error.type === 'empty' ? t('name.errorEmpty') : t('name.errorRequest')}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="mt-auto"
          icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
        >
          {t('setup.continue')}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('name.heading')}
      </p>

      {!named || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {!named ? <p className="text-center text-sm text-app-muted">{t('name.prompt')}</p> : null}
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoComplete="name"
              spellCheck={false}
              placeholder={t('name.placeholder')}
              aria-label={t('name.aria')}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
              className="min-w-0 flex-1 rounded-2xl border border-app-border-strong px-4 py-2 text-sm text-app-fg transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label={editing ? t('name.save') : t('name.saveName')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-app-btn text-app-btn-fg transition hover:bg-app-btn-hover disabled:opacity-50"
            >
              {submitIcon}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={busy}
                aria-label={t('name.cancel')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-app-border-strong text-app-fg transition hover:bg-app-hover disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-app-fg">{name}</p>
          <button
            type="button"
            onClick={() => {
              /* v8 ignore next — display branch only mounts when hasDisplayName; name is non-null */
              setDraft(name ?? '');
              setEditing(true);
              setError(null);
            }}
            disabled={busy}
            aria-label={t('name.edit')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-app-border-strong text-app-fg transition hover:bg-app-hover disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {error.type === 'empty' ? t('name.errorEmpty') : t('name.errorRequest')}
        </p>
      ) : null}
    </div>
  );
}
