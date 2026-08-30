'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { setLightningAddress, unlinkLightningAddress } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { hasLightningAddress } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/** Validation or request failure shown on the Lightning Address form. */
type LightningAddressError = { type: 'empty' } | { type: 'request' } | { type: 'notFound' };

/** Catalog key for a Lightning Address form alert. */
function lightningAddressErrorKey(
  error: LightningAddressError,
): 'la.errorEmpty' | 'la.errorNotFound' | 'la.errorRequest' {
  switch (error.type) {
    case 'empty':
      return 'la.errorEmpty';
    case 'notFound':
      return 'la.errorNotFound';
    case 'request':
      return 'la.errorRequest';
  }
}

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
 * @param props - `onboarding` shows the field at the top and **Continue** at
 *   the bottom of the screen; `profile` uses icon actions to the right of the
 *   field. Defaults from whether an address is already linked.
 * @returns The Lightning Address section, or `null` when there is nothing to show.
 */
export function LightningAddressForm(
  props: { variant?: 'onboarding' | 'profile' } = {},
): ReactElement | null {
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
  const variant = props.variant ?? (linked ? 'profile' : 'onboarding');

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
    } catch (err) {
      if (err instanceof Error && /could not be found/i.test(err.message)) {
        setError({ type: 'notFound' });
      } else {
        setError({ type: 'request' });
      }
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
        <p className="text-center text-sm text-app-muted">{t('la.prompt')}</p>
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
          className="w-full rounded-2xl border border-app-border-strong px-4 py-2 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
        />
        {error !== null ? (
          <p role="alert" className="text-center text-sm text-red-600">
            {t(lightningAddressErrorKey(error))}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-app-btn px-5 py-2.5 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover disabled:opacity-50"
        >
          {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {t('setup.continue')}
        </button>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('la.heading')}
      </p>

      {!linked || editing ? (
        <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
          {!linked ? <p className="text-center text-sm text-app-muted">{t('la.prompt')}</p> : null}
          <div className="flex items-center gap-2">
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
              className="min-w-0 flex-1 rounded-2xl border border-app-border-strong px-4 py-2 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label={editing ? t('la.save') : t('la.link')}
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
                aria-label={t('la.cancel')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-app-border-strong text-app-fg transition hover:bg-app-hover disabled:opacity-50"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-app-fg">{address}</p>
          <button
            type="button"
            onClick={() => {
              /* v8 ignore next — display branch only mounts when hasLightningAddress; address is non-null */
              setDraft(address ?? '');
              setEditing(true);
              setError(null);
            }}
            disabled={busy}
            aria-label={t('la.edit')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-app-border-strong text-app-fg transition hover:bg-app-hover disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              void run(unlinkLightningAddress);
            }}
            disabled={busy}
            aria-label={t('la.unlink')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-app-border-strong text-app-fg transition hover:bg-app-hover disabled:opacity-50"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t(lightningAddressErrorKey(error))}
        </p>
      ) : null}
    </div>
  );
}
