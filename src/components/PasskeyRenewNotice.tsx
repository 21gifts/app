'use client';

import { Loader2 } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { postPasskeyRenewAck } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { getE2eNow } from '@/lib/config';
import { renewPasskey } from '@/lib/passkey-renew';
import { useAuthStore } from '@/stores/auth-store';

/** Guided renew step. The passkey prompt itself is the device dialog. */
type RenewStep = 'explain' | 'passkey' | 'success' | 'failed';

/**
 * Screenshot fixture for one guided step (`?visual=renew-passkey`,
 * `?visual=renew-ok`), honoured only in a Playwright build (`getE2eNow()`
 * set). Live ceremonies and production builds ignore it.
 *
 * @returns The forced step, or `null` for the real flow.
 */
function fixtureStep(): RenewStep | null {
  /* v8 ignore next 3 -- client screenshots always have window */
  if (typeof window === 'undefined') {
    return null;
  }
  if (getE2eNow() === null) {
    return null;
  }
  const visual = new URLSearchParams(window.location.search).get('visual');
  if (visual === 'renew-passkey') {
    return 'passkey';
  }
  if (visual === 'renew-ok') {
    return 'success';
  }
  return null;
}

/**
 * Blocking guided renew for a member who has no seed yet. Explain, confirm,
 * device passkey prompt, then a result the member confirms. No dismiss
 * control. Nothing is stored on the account until the success confirmation.
 *
 * Mount only when `walletRequired === false`.
 *
 * @returns The current step, or nothing once success is confirmed.
 */
export function PasskeyRenewNotice(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<Account | null>(null);
  const [step, setStep] = useState<RenewStep>(
    () => fixtureStep() ?? (account?.passkeyRenewFailed === true ? 'failed' : 'explain'),
  );

  async function onConfirm(): Promise<void> {
    if (session === null || busy) {
      return;
    }
    setBusy(true);
    setStep('passkey');
    try {
      const result = await renewPasskey(session);
      if (result.outcome === 'ok' || result.outcome === 'stored') {
        setReady(result.account);
        setStep('success');
        return;
      }
      if (result.outcome === 'cancelled') {
        setStep('explain');
        return;
      }
      const open = result.account;
      if (
        open !== undefined &&
        open.passkeyRenewFailed === true &&
        useAuthStore.getState().session === session
      ) {
        setAccount(open);
        setStep('failed');
        return;
      }
      setStep('explain');
    } finally {
      setBusy(false);
    }
  }

  async function onSuccessOk(): Promise<void> {
    if (ready !== null) {
      setAccount(ready);
    }
  }

  async function onFailureOk(): Promise<void> {
    if (session === null) {
      return;
    }
    const token = session;
    setBusy(true);
    try {
      const next = await postPasskeyRenewAck(token);
      // Logout during the request must not restore this account.
      if (useAuthStore.getState().session === token) {
        setAccount(next);
      }
    } catch {
      // Stay on the failure step until the acknowledgement is stored.
    } finally {
      setBusy(false);
    }
  }

  if (account?.walletRequired !== false || account?.passkeyRenewClosed === true) {
    return null;
  }

  const titleId = `passkey-renew-${step}`;
  const title =
    step === 'passkey'
      ? t('passkeyRenew.passkeyTitle')
      : step === 'success'
        ? t('passkeyRenew.successTitle')
        : step === 'failed'
          ? t('passkeyRenew.failedTitle')
          : t('passkeyRenew.banner');
  const body =
    step === 'passkey'
      ? t('passkeyRenew.passkeyBody')
      : step === 'success'
        ? t('passkeyRenew.successBody')
        : step === 'failed'
          ? account?.passkeyRenewPrfUnsupported === true
            ? t('passkeyRenew.prfUnsupported')
            : t('passkeyRenew.failedBody')
          : t('passkeyRenew.explain');
  let action: ReactNode;
  if (step === 'passkey') {
    action = (
      <div className="flex min-h-11 w-full items-center justify-center">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-app-muted" />
      </div>
    );
  } else if (step === 'success') {
    action = (
      <Button
        type="button"
        size="lg"
        onClick={() => {
          void onSuccessOk();
        }}
      >
        {t('passkeyRenew.ok')}
      </Button>
    );
  } else if (step === 'failed') {
    action = (
      <Button
        type="button"
        size="lg"
        disabled={busy}
        onClick={() => {
          void onFailureOk();
        }}
        icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
      >
        {t('passkeyRenew.ok')}
      </Button>
    );
  } else {
    action = (
      <Button
        type="button"
        size="lg"
        disabled={busy}
        onClick={() => {
          void onConfirm();
        }}
      >
        {t('passkeyRenew.confirm')}
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card maxWidth="sm">
        <h2 id={titleId} className="w-full text-lg font-semibold tracking-tight text-app-fg">
          {title}
        </h2>
        <p className="w-full text-sm text-app-muted">{body}</p>
        {action}
      </Card>
    </div>
  );
}
