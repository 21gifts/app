'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { postPasskeyRenewAck } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { renewPasskey } from '@/lib/passkey-renew';
import { useAuthStore } from '@/stores/auth-store';

/** Guided renew step. The passkey prompt itself is the device dialog. */
type RenewStep = 'explain' | 'passkey' | 'success' | 'failed';

/**
 * Screenshot fixture for one guided step. Live ceremonies ignore this.
 *
 * @returns The forced step, or `null` for the real flow.
 */
function fixtureStep(): RenewStep | null {
  if (typeof window === 'undefined') {
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
      setStep('failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSuccessOk(): Promise<void> {
    if (ready !== null) {
      setAccount(ready);
    }
  }

  async function onTryAgain(): Promise<void> {
    if (session === null || busy) {
      return;
    }
    setBusy(true);
    try {
      setAccount(await postPasskeyRenewAck(session));
      setStep('explain');
    } catch {
      // Stay on the failure step until the acknowledgement is stored.
    } finally {
      setBusy(false);
    }
  }

  if (account?.walletRequired !== false) {
    return null;
  }

  const titleId = `passkey-renew-${step}`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card>
        {step === 'passkey' ? (
          <>
            <h2 id={titleId} className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.passkeyTitle')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.passkeyBody')}</p>
          </>
        ) : null}
        {step === 'success' ? (
          <>
            <h2 id={titleId} className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.successTitle')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.successBody')}</p>
            <Button
              type="button"
              size="lg"
              onClick={() => {
                void onSuccessOk();
              }}
            >
              {t('passkeyRenew.ok')}
            </Button>
          </>
        ) : null}
        {step === 'failed' ? (
          <>
            <h2 id={titleId} className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.failedTitle')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.failedBody')}</p>
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => {
                void onTryAgain();
              }}
            >
              {t('passkeyRenew.retry')}
            </Button>
          </>
        ) : null}
        {step === 'explain' ? (
          <>
            <h2 id={titleId} className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.banner')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.explain')}</p>
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
          </>
        ) : null}
      </Card>
    </div>
  );
}
