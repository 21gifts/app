'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { renewPasskey } from '@/lib/passkey-renew';
import { postPasskeyRenewAck } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Top-of-frame bar for a signed-in member who has no seed passkey yet, plus
 * the one-time failure dialog. Mount only when `walletRequired === false`.
 *
 * @returns The renew bar, and the failure dialog when the api still has an
 * unacknowledged failure.
 */
export function PasskeyRenewNotice(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const showDialog = account?.passkeyRenewFailed === true;

  async function onRenew(): Promise<void> {
    if (session === null) {
      return;
    }
    setBusy(true);
    try {
      const result = await renewPasskey(session);
      if (result.outcome === 'ok') {
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
      // Leave the dialog up until the acknowledgement is stored.
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex-none px-8 pb-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void onRenew();
          }}
          className="w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-left text-sm font-medium text-app-fg"
        >
          {t('passkeyRenew.banner')}
        </button>
      </div>
      {showDialog ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="passkey-renew-failed-title"
          className="absolute inset-0 z-50 flex items-center justify-center bg-app-card/80 px-8"
        >
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-card p-6 text-app-fg">
            <h2 id="passkey-renew-failed-title" className="text-base font-medium">
              {t('passkeyRenew.failedTitle')}
            </h2>
            <p className="mt-2 text-sm">{t('passkeyRenew.failedBody')}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void onOk();
              }}
              className="mt-4 rounded-xl border border-app-border px-4 py-2 text-sm font-medium"
            >
              {t('passkeyRenew.ok')}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
