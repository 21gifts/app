'use client';

import { Check, Loader2, Pencil, User } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
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
 * @returns The name section, or `null` when there is nothing to show.
 */
export function NameForm(): ReactElement | null {
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

  let submitIcon: ReactElement;
  if (busy) {
    submitIcon = <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />;
  } else if (editing) {
    submitIcon = <Check aria-hidden="true" className="h-4 w-4" />;
  } else {
    submitIcon = <User aria-hidden="true" className="h-4 w-4" />;
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-neutral-200 pt-6">
      <p className="text-center text-xs uppercase tracking-widest text-neutral-400">
        {t('name.heading')}
      </p>

      {!named || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {!named ? (
            <p className="text-center text-sm text-neutral-500">{t('name.prompt')}</p>
          ) : null}
          <input
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder={t('name.placeholder')}
            aria-label={t('name.aria')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            className="w-full rounded-2xl border border-neutral-300 px-4 py-2 text-center text-sm text-neutral-900 outline-none transition focus:border-neutral-500 disabled:opacity-50"
          />
          <div className="flex items-center justify-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {submitIcon}
              {editing ? t('name.save') : t('name.saveName')}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                disabled={busy}
                className="inline-flex items-center rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {t('name.cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-neutral-900">{name}</p>
          <button
            type="button"
            onClick={() => {
              /* v8 ignore next — display branch only mounts when hasDisplayName; name is non-null */
              setDraft(name ?? '');
              setEditing(true);
              setError(null);
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            {t('name.edit')}
          </button>
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error.type === 'empty' ? t('name.errorEmpty') : t('name.errorRequest')}
        </p>
      ) : null}
    </div>
  );
}
