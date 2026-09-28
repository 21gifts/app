'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { postPasskeyRenewAck } from '@/lib/api';
import { renewPasskey } from '@/lib/passkey-renew';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Blocking foreground dialog for a signed-in member who has no seed yet.
 * There is no dismiss control. The only way through is a successful renew.
 * An unacknowledged failure replaces that dialog until OK; the force dialog
 * returns afterwards because the account still has no seed.
 *
 * Mount only when `walletRequired === false`.
 *
 * @returns The blocking dialog, or nothing once the account has a seed.
 */
export function PasskeyRenewNotice(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const failed = account?.passkeyRenewFailed === true;

  async function onRenew(): Promise<void> {
    if (session === null) {
      return;
    }
    setBusy(true);
    try {
      const result = await renewPasskey(session);
      if (result.outcome === 'ok' || result.outcome === 'stored') {
        setAccount(result.account);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onOk(): Promise<void> {
    if (session === null) {
      return;
    }
    setBusy(true);
    try {
      setAccount(await postPasskeyRenewAck(session));
    } catch {
      // Leave the failure dialog up until the acknowledgement is stored.
    } finally {
      setBusy(false);
    }
  }

  if (account?.walletRequired !== false) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={failed ? 'passkey-renew-failed-title' : 'passkey-renew-title'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card>
        {failed ? (
          <>
            <h2 id="passkey-renew-failed-title" className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.failedTitle')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.failedBody')}</p>
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => {
                void onOk();
              }}
            >
              {t('passkeyRenew.ok')}
            </Button>
          </>
        ) : (
          <>
            <h2 id="passkey-renew-title" className="text-lg font-semibold text-app-fg">
              {t('passkeyRenew.banner')}
            </h2>
            <p className="text-sm text-app-muted">{t('passkeyRenew.forceBody')}</p>
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => {
                void onRenew();
              }}
            >
              {t('passkeyRenew.banner')}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
