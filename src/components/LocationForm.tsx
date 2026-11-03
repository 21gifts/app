'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { IconButton } from '@/components/ui';
import { setLocation } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { LOCATION_LENGTH_MESSAGE, locationProblem } from '@/lib/profile-fields';
import { useAuthStore } from '@/stores/auth-store';

/** Shown under the location field, or under the display row after a failed clear. */
type LocationVisible = 'long' | 'controls' | 'request';

/**
 * Catalog key for a visible location message.
 *
 * @param kind - The problem currently shown.
 * @returns The message key.
 */
function locationErrorKey(
  kind: LocationVisible,
): 'location.errorLength' | 'location.errorControls' | 'location.errorRequest' {
  switch (kind) {
    case 'long':
      return 'location.errorLength';
    case 'controls':
      return 'location.errorControls';
    case 'request':
      return 'location.errorRequest';
  }
}

/**
 * True when the stored location is a non-empty trimmed string.
 *
 * @param location - Account location, which may be null or whitespace.
 * @returns Whether the profile should show the set (value + clear) row.
 */
function hasLocation(location: string | null | undefined): boolean {
  return location !== null && location !== undefined && location.trim() !== '';
}

/**
 * Lets a signed-in giver set, edit, or clear the free-text location on their
 * profile card. The resting value is centered, in the same color whether it
 * is set or still **Not set**, with the pencil and trash beside it.
 *
 * Reads the current account and session token from the auth store and merges
 * only `location` into that account so a concurrent name write is
 * not overwritten. Renders nothing when no account — or, defensively, no
 * session token — is present. Empty after trim is a valid save and clears.
 *
 * An untouched field stays quiet. After a change, blur, or submit, a broken
 * length or control rule is shown under the field and Save is disabled. Clear
 * stays its own action. A known api length sentence uses the length key.
 *
 * @param props - Optional `startEditing` opens the field on mount.
 * @returns The location section, or `null` when there is nothing to show.
 */
export function LocationForm({
  startEditing = false,
}: {
  startEditing?: boolean;
} = {}): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<'long' | 'request' | null>(null);
  const errorId = useId();

  if (account === null || session === null) {
    return null;
  }

  const location = account.location;
  const set = hasLocation(location);
  const problem = locationProblem(draft);
  let fieldKind: LocationVisible | null = null;
  if (editing) {
    if (touched && problem !== null) {
      fieldKind = problem;
    } else {
      fieldKind = serverError;
    }
  }
  const displayKind = editing ? null : serverError;
  const submitDisabled = busy || fieldKind === 'long' || fieldKind === 'controls';

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
    setServerError(null);
    try {
      const result = await action(session);
      if (useAuthStore.getState().session !== session) {
        return;
      }
      onFresh(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message === LOCATION_LENGTH_MESSAGE) {
        setServerError('long');
      } else {
        setServerError('request');
      }
    } finally {
      setBusy(false);
    }
  };

  const applyLocation = (updated: Account): void => {
    const current = useAuthStore.getState().account;
    if (current === null) {
      return;
    }
    setAccount({
      ...current,
      location: updated.location,
    });
    setEditing(false);
    setTouched(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setTouched(true);
    if (locationProblem(draft) !== null) {
      return;
    }
    void runGuarded((token) => setLocation(token, draft.trim()), applyLocation);
  };

  const handleClear = (): void => {
    void runGuarded((token) => setLocation(token, ''), applyLocation);
  };

  const startEdit = (): void => {
    setDraft(location ?? '');
    setEditing(true);
    setServerError(null);
    setTouched(false);
  };

  const submitIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const fieldAlert =
    fieldKind === null ? null : (
      <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
        {t(locationErrorKey(fieldKind))}
      </p>
    );

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('location.heading')}
      </p>

      {editing ? (
        <SundayWritingGate>
          <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                autoComplete="address-level2"
                spellCheck={false}
                placeholder={t('location.placeholder')}
                aria-label={t('location.aria')}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setTouched(true);
                  setServerError(null);
                }}
                onBlur={() => {
                  setTouched(true);
                }}
                disabled={busy}
                {...(fieldKind === null
                  ? {}
                  : { 'aria-invalid': true as const, 'aria-describedby': errorId })}
                className="min-h-11 min-w-0 flex-1 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50"
              />
              <IconButton
                type="submit"
                variant="primary"
                size="md"
                disabled={submitDisabled}
                aria-label={t('location.save')}
              >
                {submitIcon}
              </IconButton>
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={busy}
                aria-label={t('location.cancel')}
                onClick={() => {
                  setEditing(false);
                  setServerError(null);
                  setTouched(false);
                }}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
            {fieldAlert}
          </form>
        </SundayWritingGate>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <p className="min-w-0 truncate text-center text-sm text-app-fg">
            {set ? location : t('location.unset')}
          </p>
          <SundayWritingGate>
            <div className="flex items-center gap-2">
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={busy}
                aria-label={t('location.edit')}
                onClick={startEdit}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </IconButton>
              {set ? (
                <IconButton
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  aria-label={t('location.clear')}
                  onClick={handleClear}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              ) : null}
            </div>
          </SundayWritingGate>
        </div>
      )}

      {displayKind !== null ? (
        <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
          {t(locationErrorKey(displayKind))}
        </p>
      ) : null}
    </div>
  );
}
