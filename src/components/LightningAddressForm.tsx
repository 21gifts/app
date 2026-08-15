'use client';

import { AtSign, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { setLightningAddress, unlinkLightningAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Lets a signed-in giver link, edit, or unlink the Lightning Address that
 * receives their gifts.
 *
 * Reads the current account and session token from the auth store and writes the
 * api's updated account straight back into it, so the surrounding signed-in view
 * re-renders in place. Renders nothing when no account — or, defensively, no
 * session token — is present, since it is only mounted inside the logged-in view.
 *
 * @returns The Lightning Address section, or `null` when there is nothing to show.
 */
export function LightningAddressForm(): ReactElement | null {
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

  const address = account.lightningAddress;

  /**
   * Runs a store-updating api action with shared busy/error handling.
   *
   * @param action - The api call to run with the session token.
   */
  const run = async (action: (token: string) => Promise<Account>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const updated = await action(session);
      // Drop the result if the session changed while the request was in flight
      // (e.g. the user logged out): a late write would otherwise revive the
      // signed-in view with an already-cleared session.
      if (useAuthStore.getState().session !== session) {
        return;
      }
      setAccount(updated);
      setEditing(false);
      if (updated.lightningAddress === null) {
        setDraft('');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void run((token) => setLightningAddress(token, draft));
  };

  let submitIcon: ReactElement;
  if (busy) {
    submitIcon = <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />;
  } else if (editing) {
    submitIcon = <Check aria-hidden="true" className="h-4 w-4" />;
  } else {
    submitIcon = <AtSign aria-hidden="true" className="h-4 w-4" />;
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-neutral-200 pt-6">
      <p className="text-center text-xs uppercase tracking-widest text-neutral-400">
        Lightning Address
      </p>

      {address === null || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {address === null ? (
            <p className="text-center text-sm text-neutral-500">
              Link a Lightning Address so gifts can reach you.
            </p>
          ) : null}
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="you@walletofsatoshi.com"
            aria-label="Lightning Address"
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
              {editing ? 'Save' : 'Link address'}
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
          <p className="font-mono text-sm text-neutral-900">{address}</p>
          {!account.lightningAddressVerified ? (
            <p className="text-xs text-neutral-400">Not yet verified</p>
          ) : null}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(address);
                setEditing(true);
                setError(null);
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => void run(unlinkLightningAddress)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Unlink
            </button>
          </div>
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
