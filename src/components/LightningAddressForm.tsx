'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { AppShellFooter } from '@/components/AppShell';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import {
  LIGHTNING_ADDRESS_NOT_ZAP_ERROR,
  setLightningAddress,
  skipSetup,
  unlinkLightningAddress,
} from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { hasLightningAddress } from '@/lib/onboarding';
import {
  LIGHTNING_ADDRESS_FORMAT_MESSAGE,
  LIGHTNING_ADDRESS_FORMAT_REWRITTEN,
  LIGHTNING_ADDRESS_TAKEN_MESSAGE,
  LIGHTNING_ADDRESS_TAKEN_REWRITTEN,
  LIGHTNING_ADDRESS_UNRESOLVED_MESSAGE,
  LIGHTNING_ADDRESS_UNRESOLVED_REWRITTEN,
  lightningAddressProblem,
} from '@/lib/profile-fields';
import { useAuthStore } from '@/stores/auth-store';

/** Failure stored after a save or unlink. Empty, long, and format also come from the draft. */
type LightningAddressError =
  | { type: 'format' }
  | { type: 'taken' }
  | { type: 'request' }
  | { type: 'notFound' }
  | { type: 'notZap' };

/** Every address message the field can show. */
type LightningFieldProblem =
  'empty' | 'long' | 'format' | 'taken' | 'notFound' | 'notZap' | 'request';

/**
 * Catalog key for a Lightning Address form alert.
 *
 * @param kind - The problem currently shown.
 * @returns The message key.
 */
function lightningAddressErrorKey(
  kind: LightningFieldProblem,
):
  | 'la.errorEmpty'
  | 'la.errorLength'
  | 'la.errorFormat'
  | 'la.errorTaken'
  | 'la.errorNotFound'
  | 'la.errorRequest'
  | 'la.errorNotZap' {
  switch (kind) {
    case 'empty':
      return 'la.errorEmpty';
    case 'long':
      return 'la.errorLength';
    case 'format':
      return 'la.errorFormat';
    case 'taken':
      return 'la.errorTaken';
    case 'notFound':
      return 'la.errorNotFound';
    case 'notZap':
      return 'la.errorNotZap';
    case 'request':
      return 'la.errorRequest';
  }
}

/**
 * Maps a save or unlink failure onto the address field.
 *
 * Exact api sentences and the copies produced before this form see them both count.
 * `Invalid Lightning Address` is not a format error.
 *
 * @param caught - Rejection from `setLightningAddress` or `unlinkLightningAddress`.
 * @param trimmed - Address that was submitted, used to lock a non-zap address.
 * @returns The alert to show and the address that stays blocked, if any.
 */
function classifyLightningFailure(
  caught: unknown,
  trimmed: string,
): { error: LightningAddressError; blocked: string | null } {
  if (caught instanceof Error && caught.message === LIGHTNING_ADDRESS_NOT_ZAP_ERROR) {
    return { error: { type: 'notZap' }, blocked: trimmed };
  }
  if (!(caught instanceof Error)) {
    return { error: { type: 'request' }, blocked: null };
  }
  const message = caught.message;
  if (
    message === LIGHTNING_ADDRESS_UNRESOLVED_MESSAGE ||
    message === LIGHTNING_ADDRESS_UNRESOLVED_REWRITTEN
  ) {
    return { error: { type: 'notFound' }, blocked: null };
  }
  if (
    message === LIGHTNING_ADDRESS_FORMAT_MESSAGE ||
    message === LIGHTNING_ADDRESS_FORMAT_REWRITTEN
  ) {
    return { error: { type: 'format' }, blocked: null };
  }
  if (
    message === LIGHTNING_ADDRESS_TAKEN_MESSAGE ||
    message === LIGHTNING_ADDRESS_TAKEN_REWRITTEN
  ) {
    return { error: { type: 'taken' }, blocked: null };
  }
  return { error: { type: 'request' }, blocked: null };
}

/**
 * Lets a signed-in giver link, edit, or unlink the Lightning Address that
 * receives their gifts.
 *
 * An untouched field stays quiet. After a change, blur, or submit, an empty,
 * too-long, or badly shaped address is shown under the field and Link or Save
 * is disabled. Skip stays available. Unlink is its own action. After `notZap`,
 * Continue/Save stay disabled while the trimmed draft equals the blocked
 * address; changing the draft clears the alert and re-enables; restoring the
 * blocked address re-locks. A taken address, or an address that could not be
 * found, shows that sentence and disables Continue/Save until the draft
 * changes. Changing the draft clears it. Restoring the same address does not
 * lock again.
 *
 * @param props - `onboarding` shows the field at the top and **Continue** plus
 *   **Skip** at the bottom; `profile` uses icon actions to the right of the
 *   field (no Skip). Defaults from whether an address is already linked.
 *   Optional `onSaved` runs after a successful address save (not Skip or unlink).
 * @returns The Lightning Address section, or `null` when there is nothing to show.
 */
export function LightningAddressForm(
  props: { variant?: 'onboarding' | 'profile'; onSaved?: () => void } = {},
): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<LightningAddressError | null>(null);
  const [blockedAddress, setBlockedAddress] = useState<string | null>(null);
  const formId = useId();
  const errorId = `${formId}-error`;

  if (account === null || session === null) {
    return null;
  }

  const address = account.lightningAddress;
  const linked = hasLightningAddress(account);
  const variant = props.variant ?? (linked ? 'profile' : 'onboarding');
  const problem = lightningAddressProblem(draft);
  let visibleType: LightningFieldProblem | null = null;
  if (touched && problem !== null) {
    visibleType = problem;
  } else if (error !== null) {
    visibleType = error.type;
  }
  const ruleBroken =
    visibleType === 'empty' ||
    visibleType === 'long' ||
    visibleType === 'format' ||
    visibleType === 'taken' ||
    visibleType === 'notFound';
  const continueDisabled =
    busy || ruleBroken || (blockedAddress !== null && draft.trim() === blockedAddress);
  const showEditor = variant === 'onboarding' || !linked || editing;

  const onDraftChange = (next: string): void => {
    setDraft(next);
    setTouched(true);
    if (blockedAddress !== null && next.trim() === blockedAddress) {
      setError({ type: 'notZap' });
    } else {
      setError(null);
    }
  };

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
      if (useAuthStore.getState().session !== session) {
        return;
      }
      onFresh(result);
      setBlockedAddress(null);
    } catch (err: unknown) {
      const failure = classifyLightningFailure(err, draft.trim());
      setError(failure.error);
      setBlockedAddress(failure.blocked);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Runs a store-updating api action with shared busy/error handling.
   *
   * @param action - The api call to run with the session token.
   */
  const run = async (
    action: (token: string) => Promise<Account>,
    options: { notifySaved?: boolean } = {},
  ): Promise<void> => {
    await runGuarded(action, (updated) => {
      const current = useAuthStore.getState().account;
      if (current === null) {
        return;
      }
      setAccount({
        ...current,
        lightningAddress: updated.lightningAddress,
        lightningAddressVerified: updated.lightningAddressVerified,
        setup: updated.setup,
        missing: updated.missing,
      });
      setEditing(false);
      setTouched(false);
      if (updated.lightningAddress === null) {
        setDraft('');
      }
      if (options.notifySaved === true) {
        props.onSaved?.();
      }
    });
  };

  const handleSkip = (): void => {
    void runGuarded(
      (token) => skipSetup(token, 'lightning-address'),
      (updated) => {
        const current = useAuthStore.getState().account;
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setTouched(true);
    if (lightningAddressProblem(draft) !== null) {
      return;
    }
    const trimmed = draft.trim();
    if (blockedAddress !== null && trimmed === blockedAddress) {
      setError({ type: 'notZap' });
      return;
    }
    void run(
      (token) =>
        setLightningAddress(token, trimmed, variant === 'onboarding' ? 'setup' : 'enforce'),
      { notifySaved: true },
    );
  };

  const submitIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const inputClass =
    'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-base text-app-fg transition focus-visible:border-app-fg disabled:opacity-50';

  const fieldAria =
    showEditor && visibleType !== null
      ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
      : {};

  const addressAlert =
    showEditor && visibleType !== null ? (
      <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
        {t(lightningAddressErrorKey(visibleType))}
      </p>
    ) : null;

  if (variant === 'onboarding') {
    return (
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="mt-6 flex w-full flex-col items-stretch gap-3"
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
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          onBlur={() => {
            setTouched(true);
          }}
          disabled={busy}
          {...fieldAria}
          className={inputClass}
        />
        {addressAlert}
        <AppShellFooter>
          <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-3">
            <Button
              type="submit"
              form={formId}
              size="lg"
              disabled={continueDisabled}
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
        {t('la.heading')}
      </p>

      {!linked || editing ? (
        <SundayWritingGate>
          <form onSubmit={handleSubmit} className="flex flex-col items-stretch gap-3">
            {!linked ? (
              <p className="text-center text-sm text-app-muted">{t('la.prompt')}</p>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder="you@walletofsatoshi.com"
                aria-label={t('la.aria')}
                value={draft}
                onChange={(event) => {
                  onDraftChange(event.target.value);
                }}
                onBlur={() => {
                  setTouched(true);
                }}
                disabled={busy}
                {...fieldAria}
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <IconButton
                type="submit"
                variant="primary"
                disabled={continueDisabled}
                aria-label={editing ? t('la.save') : t('la.link')}
              >
                {submitIcon}
              </IconButton>
              {editing ? (
                <IconButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                    setBlockedAddress(null);
                    setTouched(false);
                  }}
                  disabled={busy}
                  aria-label={t('la.cancel')}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              ) : null}
            </div>
            {addressAlert}
          </form>
        </SundayWritingGate>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-app-fg">{address}</p>
          <SundayWritingGate>
            <IconButton
              type="button"
              variant="secondary"
              onClick={() => {
                /* v8 ignore next — display branch only mounts when hasLightningAddress; address is non-null */
                setDraft(address ?? '');
                setEditing(true);
                setError(null);
                setBlockedAddress(null);
                setTouched(false);
              }}
              disabled={busy}
              aria-label={t('la.edit')}
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <IconButton
              type="button"
              variant="secondary"
              onClick={() => {
                void run(unlinkLightningAddress);
              }}
              disabled={busy}
              aria-label={t('la.unlink')}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </SundayWritingGate>
        </div>
      )}

      {linked && !editing && error !== null ? (
        <p id={errorId} role="alert" className="text-center text-sm text-app-danger">
          {t(lightningAddressErrorKey(error.type))}
        </p>
      ) : null}
    </div>
  );
}
