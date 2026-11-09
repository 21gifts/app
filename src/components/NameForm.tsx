'use client';

import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { AppShellFooter } from '@/components/AppShell';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import { setName, skipSetup } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { hasDisplayName } from '@/lib/onboarding';
import { DISPLAY_NAME_LENGTH_MESSAGE, displayNameProblem } from '@/lib/profile-fields';
import { useAuthStore } from '@/stores/auth-store';

/** Shown under the name field once a rule or an unknown save failure is visible. */
type NameVisible = 'empty' | 'long' | 'controls' | 'request';

/**
 * Catalog key for a visible name-field message.
 *
 * @param kind - The problem currently shown under the field.
 * @returns The message key.
 */
function nameErrorKey(
  kind: NameVisible,
): 'name.errorEmpty' | 'name.errorLength' | 'name.errorControls' | 'name.errorRequest' {
  switch (kind) {
    case 'empty':
      return 'name.errorEmpty';
    case 'long':
      return 'name.errorLength';
    case 'controls':
      return 'name.errorControls';
    case 'request':
      return 'name.errorRequest';
  }
}

/**
 * Lets a signed-in giver set or edit the display name shown on their account.
 *
 * Reads the current account and session token from the auth store and merges
 * the saved `name`, `setup`, and `missing` into that account so a concurrent
 * location or rules write is not overwritten. Renders nothing when no account — or,
 * defensively, no session token — is present, since it is only mounted inside
 * the logged-in view.
 *
 * Treats a missing or whitespace-only name the same as `hasDisplayName`: the
 * prompt and input stay up until a non-empty trimmed name is saved.
 *
 * An untouched field stays quiet. After a change, blur, or submit, a broken
 * rule is shown under the field and Continue or Save is disabled. Skip stays
 * available. A known api length sentence uses the length key, not the generic
 * save failure.
 *
 * @param props - `onboarding` shows the field at the top and **Continue** plus
 *   **Skip** at the bottom; `profile` centers the saved name and puts the
 *   pencil beside it (no Skip). Optional `besideName` and `belowName` are
 *   the public marks and hint sentences a visitor sees on that row. They stay
 *   visible while the name is unset and while the field is open.
 *   Defaults from whether a name is already saved.
 *   Optional `onSaved` runs after a successful name save.
 * @returns The name section, or `null` when there is nothing to show.
 */
export function NameForm(
  props: {
    variant?: 'onboarding' | 'profile';
    onSaved?: () => void;
    besideName?: ReactNode;
    belowName?: ReactNode;
  } = {},
): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<'long' | 'request' | null>(null);
  const formId = useId();
  const errorId = `${formId}-error`;

  if (account === null || session === null) {
    return null;
  }

  const name = account.name;
  const named = hasDisplayName(account);
  const variant = props.variant ?? (named ? 'profile' : 'onboarding');
  const problem = displayNameProblem(draft);
  let visibleKind: NameVisible | null = null;
  if (touched && problem !== null) {
    visibleKind = problem;
  } else if (serverError !== null) {
    visibleKind = serverError;
  }
  const submitDisabled =
    busy || visibleKind === 'empty' || visibleKind === 'long' || visibleKind === 'controls';

  const onDraftChange = (value: string): void => {
    setDraft(value);
    setTouched(true);
    setServerError(null);
  };

  const onDraftBlur = (): void => {
    setTouched(true);
  };

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
      if (message === DISPLAY_NAME_LENGTH_MESSAGE) {
        setServerError('long');
      } else {
        setServerError('request');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setTouched(true);
    if (displayNameProblem(draft) !== null) {
      return;
    }
    const trimmed = draft.trim();
    void runGuarded(
      (token) => setName(token, trimmed, variant === 'onboarding' ? 'setup' : 'enforce'),
      (updated) => {
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        // Keep fields this form does not own so a concurrent location save
        // is not overwritten by a stale full-account response.
        setAccount({
          ...current,
          name: updated.name,
          setup: updated.setup,
          missing: updated.missing,
        });
        setEditing(false);
        props.onSaved?.();
      },
    );
  };

  const handleSkip = (): void => {
    void runGuarded(
      (token) => skipSetup(token, 'name'),
      (updated) => {
        const current = useAuthStore.getState().account;
        /* v8 ignore next 3 -- skip returns after logout */
        if (current === null) {
          return;
        }
        setAccount({
          ...current,
          setup: updated.setup,
          missing: updated.missing,
        });
      },
    );
  };

  const submitIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const nameAlert =
    visibleKind === null ? null : (
      <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
        {t(nameErrorKey(visibleKind))}
      </p>
    );

  const fieldAria =
    visibleKind === null ? {} : { 'aria-invalid': true as const, 'aria-describedby': errorId };

  if (variant === 'onboarding') {
    return (
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="mt-6 flex w-full flex-col items-stretch gap-3"
      >
        <p className="text-center text-sm text-app-muted">{t('name.prompt')}</p>
        <input
          type="text"
          autoComplete="name"
          spellCheck={false}
          placeholder={t('name.placeholder')}
          aria-label={t('name.aria')}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          onBlur={onDraftBlur}
          disabled={busy}
          {...fieldAria}
          className="w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50"
        />
        {nameAlert}
        <AppShellFooter>
          <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-3">
            <Button
              type="submit"
              form={formId}
              size="lg"
              disabled={submitDisabled}
              icon={
                busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
              }
            >
              {t('setup.continue')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={handleSkip}
            >
              {t('setup.skip')}
            </Button>
          </div>
        </AppShellFooter>
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('name.heading')}
      </p>

      {!named || editing ? (
        <>
          <SundayWritingGate>
            <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
              {!named ? (
                <p className="text-center text-sm text-app-muted">{t('name.prompt')}</p>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoComplete="name"
                  spellCheck={false}
                  placeholder={t('name.placeholder')}
                  aria-label={t('name.aria')}
                  value={draft}
                  onChange={(event) => {
                    onDraftChange(event.target.value);
                  }}
                  onBlur={onDraftBlur}
                  disabled={busy}
                  {...fieldAria}
                  className="min-h-11 min-w-0 flex-1 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50"
                />
                <IconButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitDisabled}
                  aria-label={editing ? t('name.save') : t('name.saveName')}
                >
                  {submitIcon}
                </IconButton>
                {editing ? (
                  <IconButton
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={busy}
                    aria-label={t('name.cancel')}
                    onClick={() => {
                      setEditing(false);
                      setServerError(null);
                      setTouched(false);
                    }}
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
              {nameAlert}
            </form>
          </SundayWritingGate>
          {props.besideName ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {props.besideName}
            </div>
          ) : null}
          {props.belowName}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="min-w-0 truncate text-center text-sm text-app-fg">{name}</p>
            {props.besideName}
            <SundayWritingGate>
              <IconButton
                type="button"
                variant="secondary"
                size="md"
                disabled={busy}
                aria-label={t('name.edit')}
                onClick={() => {
                  /* v8 ignore next — display branch only mounts when hasDisplayName; name is non-null */
                  setDraft(name ?? '');
                  setEditing(true);
                  setServerError(null);
                  setTouched(false);
                }}
              >
                <Pencil aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </SundayWritingGate>
          </div>
          {props.belowName}
        </>
      )}
    </div>
  );
}
