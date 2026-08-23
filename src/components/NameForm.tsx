'use client';

import { Check, Loader2, Pencil, User } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { setName } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lets a signed-in giver set or edit the display name shown on their account.
 *
 * Reads the current account and session token from the auth store and writes the
 * api's updated account straight back into it, so the surrounding signed-in view
 * re-renders in place. Renders nothing when no account — or, defensively, no
 * session token — is present, since it is only mounted inside the logged-in view.
 *
 * @returns The name section, or `null` when there is nothing to show.
 */
export function NameForm(): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account === null || session === null) {
    return null;
  }

  const name = account.name;

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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError('Enter your name');
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
      <p className="text-center text-xs uppercase tracking-widest text-neutral-400">Name</p>

      {name === null || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {name === null ? (
            <p className="text-center text-sm text-neutral-500">
              Add your name so people know who you are.
            </p>
          ) : null}
          <input
            type="text"
            autoComplete="name"
            spellCheck={false}
            placeholder="Your name"
            aria-label="Name"
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
              {editing ? 'Save' : 'Save name'}
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
                Cancel
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
              setDraft(name);
              setEditing(true);
              setError(null);
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
            Edit
          </button>
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
