'use client';

import { Loader2 } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { agreeToRules } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Third post-login screen: living-room rules body and an **I agree** control.
 *
 * Merges only `rulesAgreedAt` into the auth-store account so concurrent name or
 * address writes are not overwritten. Renders nothing without a session token.
 *
 * @param props - Server-rendered {@link RulesDocument} as `children`.
 * @returns The rules setup screen, or `null` when logged out.
 */
export function RulesSetup({ children }: { children: ReactNode }): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (account === null || session === null) {
    return null;
  }

  const handleAgree = (): void => {
    setBusy(true);
    setError(false);
    void (async () => {
      try {
        const updated = await agreeToRules(session);
        if (useAuthStore.getState().session !== session) {
          return;
        }
        const current = useAuthStore.getState().account;
        if (current === null) {
          return;
        }
        setAccount({ ...current, rulesAgreedAt: updated.rulesAgreedAt });
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <section className="flex w-full max-w-3xl flex-1 flex-col gap-6 pb-8 pt-24">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('setup.rulesTitle')}</h1>
      <p className="text-center text-sm text-app-muted">{t('setup.rulesPrompt')}</p>
      {children}
      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('setup.rulesErrorRequest')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleAgree}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-app-btn px-5 py-2.5 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover disabled:opacity-50"
      >
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        {t('setup.agree')}
      </button>
    </section>
  );
}
