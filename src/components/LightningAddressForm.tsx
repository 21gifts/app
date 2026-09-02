'use client';

import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactElement } from 'react';
import { AppShellFooter } from '@/components/AppShell';
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
import { useAuthStore } from '@/stores/auth-store';

/** Validation or request failure shown on the Lightning Address form. */
type LightningAddressError =
  { type: 'empty' } | { type: 'request' } | { type: 'notFound' } | { type: 'notZap' };

/** Catalog key for a Lightning Address form alert. */
function lightningAddressErrorKey(
  error: LightningAddressError,
): 'la.errorEmpty' | 'la.errorNotFound' | 'la.errorRequest' | 'la.errorNotZap' {
  switch (error.type) {
    case 'empty':
      return 'la.errorEmpty';
    case 'notFound':
      return 'la.errorNotFound';
    case 'notZap':
      return 'la.errorNotZap';
    case 'request':
      return 'la.errorRequest';
  }
}

/**
 * Lets a signed-in giver link, edit, or unlink the Lightning Address that
 * receives their gifts.
 *
 * @param props - `onboarding` shows the field at the top and **Continue** plus
 *   **Skip** at the bottom; `profile` uses icon actions to the right of the
 *   field (no Skip). Defaults from whether an address is already linked. After
 *   `notZap`, Continue/Save stay disabled while the trimmed draft equals the
 *   blocked address; changing the draft clears the alert and re-enables;
 *   restoring the blocked address re-locks.
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
  const [blockedAddress, setBlockedAddress] = useState<string | null>(null);
  const formId = useId();

  if (account === null || session === null) {
    return null;
  }

  const address = account.lightningAddress;
  const linked = hasLightningAddress(account);
  const variant = props.variant ?? (linked ? 'profile' : 'onboarding');
  const continueDisabled = busy || (blockedAddress !== null && draft.trim() === blockedAddress);

  const onDraftChange = (next: string): void => {
    setDraft(next);
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
    } catch (err) {
      if (err instanceof Error && err.message === LIGHTNING_ADDRESS_NOT_ZAP_ERROR) {
        setError({ type: 'notZap' });
        setBlockedAddress(draft.trim());
      } else if (err instanceof Error && /could not be found/i.test(err.message)) {
        setError({ type: 'notFound' });
        setBlockedAddress(null);
      } else {
        setError({ type: 'request' });
        setBlockedAddress(null);
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
      setAccount({
        ...current,
        lightningAddress: updated.lightningAddress,
        lightningAddressVerified: updated.lightningAddressVerified,
        setup: updated.setup,
        missing: updated.missing,
      });
      setEditing(false);
      if (updated.lightningAddress === null) {
        setDraft('');
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
    const trimmed = draft.trim();
    if (trimmed === '') {
      setError({ type: 'empty' });
      return;
    }
    if (blockedAddress !== null && trimmed === blockedAddress) {
      setError({ type: 'notZap' });
      return;
    }
    void run((token) => setLightningAddress(token, trimmed));
  };

  const submitIcon = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : (
    <Check aria-hidden="true" className="h-4 w-4" />
  );

  const inputClass =
    'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-sm text-app-fg transition focus-visible:border-app-fg disabled:opacity-50';

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
          disabled={busy}
          className={inputClass}
        />
        {error !== null ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t(lightningAddressErrorKey(error))}
          </p>
        ) : null}
        <AppShellFooter>
          <div className="flex w-full flex-col items-stretch gap-3">
            <Button
              type="submit"
              form={formId}
              className="w-full"
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
              onChange={(event) => {
                onDraftChange(event.target.value);
              }}
              disabled={busy}
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
                }}
                disabled={busy}
                aria-label={t('la.cancel')}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            ) : null}
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-mono text-sm text-app-fg">{address}</p>
          <IconButton
            type="button"
            variant="secondary"
            onClick={() => {
              /* v8 ignore next — display branch only mounts when hasLightningAddress; address is non-null */
              setDraft(address ?? '');
              setEditing(true);
              setError(null);
              setBlockedAddress(null);
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
        </div>
      )}

      {error !== null ? (
        <p role="alert" className="text-center text-sm text-app-danger">
          {t(lightningAddressErrorKey(error))}
        </p>
      ) : null}
    </div>
  );
}
