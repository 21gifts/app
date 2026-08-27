'use client';

import { AtSign, Check, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { setLightningAddress, unlinkLightningAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { hasLightningAddress } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/** Validation or request failure shown on the Lightning Address form. */
type LightningAddressError = { type: 'empty' } | { type: 'request' };

/**
 * Lets a signed-in giver link, edit, or unlink the Lightning Address that
 * receives their gifts.
 *
 * Reads the current account and session token from the auth store and merges
 * the saved Lightning Address fields into that account so a concurrent name
 * write is not overwritten. Renders nothing when no account — or, defensively,
 * no session token — is present, since it is only mounted inside the logged-in view.
 *
 * Treats a missing or whitespace-only address the same as `hasLightningAddress`:
 * the link prompt stays up until a non-empty trimmed address is saved.
 *
 * @returns The Lightning Address section, or `null` when there is nothing to show.
 */
export function LightningAddressForm(): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LightningAddressError | null>(null);

  if (account === null || session === null) {
    return null;
  }

  const address = account.lightningAddress;
  const linked = hasLightningAddress(account);

  /**
   * Runs an api action with shared busy/error handling and a stale-session guard.
   *
   * @param action - The api call to run with the session token.
   * @param onFresh - Called with the result only if the session is still the
   * one that started the request.
   */
  const runGuarded = async <T,>(
    action: (token: string) => Promise<T>,
    onFresh: (result: T) => void,
  ): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await action(session);
      // Drop the result if the session changed while the request was in flight
      // (e.g. the user logged out): a late write would otherwise revive the
      // signed-in view with an already-cleared session.
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

  /**
   * Runs a store-updating api action with shared busy/error handling.
   *
   * @param action - The api call to run with the session token.
   */
  const run = async (action: (token: string) => Promise<Account>): Promise<void> => {
    await runGuarded(action, (updated) => {
      const current = useAuthStore.getState().account;
      if (current === null) {
        return;
      }
      // Keep fields this form does not own so a concurrent name save is not
      // overwritten by a stale full-account response.
      setAccount({
        ...current,
        lightningAddress: updated.lightningAddress,
        lightningAddressVerified: updated.lightningAddressVerified,
      });
      setEditing(false);
      if (updated.lightningAddress === null) {
        setDraft('');
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError({ type: 'empty' });
      return;
    }
    void run((token) => setLightningAddress(token, trimmed));
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
      <p className="text-center text-xs tracking-widest text-neutral-400 uppercase">
        {t('la.heading')}
      </p>

      {!linked || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {!linked ? (
            <p className="text-center text-sm text-neutral-500">{t('la.prompt')}</p>
          ) : null}
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            placeholder="you@walletofsatoshi.com"
            aria-label={t('la.aria')}
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
              {editing ? t('la.save') : t('la.link')}
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
                {t('la.cancel')}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-sm text-neutral-900">{address}</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                /* v8 ignore next — display branch only mounts when hasLightningAddress; address is non-null */
                setDraft(address ?? '');
                setEditing(true);
                setError(null);
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              {t('la.edit')}
            </button>
            <button
              type="button"
              onClick={() => {
                void run(unlinkLightningAddress);
              }}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {t('la.unlink')}
            </button>
          </div>
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error.type === 'empty' ? t('la.errorEmpty') : t('la.errorRequest')}
        </p>
      ) : null}
    </div>
  );
}
