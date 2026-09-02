'use client';

import { Loader2, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { Button, IconButton } from '@/components/ui';
import { agreeToRules } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link RequirementsOverlay}. */
export interface RequirementsOverlayProps {
  /** Field the visitor must add before the pending post retries. */
  requirement: 'name' | 'rules';
  /** Closes the overlay without posting. */
  onDismiss: () => void;
  /** Called after the requirement is saved so the loader can retry. */
  onSatisfied: () => void;
}

/**
 * Modal to add a missing name or living-room rules agreement before retrying a
 * forum or contact post. No Skip control.
 *
 * @param props - See {@link RequirementsOverlayProps}.
 * @returns The overlay dialog.
 */
export function RequirementsOverlay({
  requirement,
  onDismiss,
  onSatisfied,
}: RequirementsOverlayProps): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const handleAgree = (): void => {
    if (session === null || busy) {
      return;
    }
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
        setAccount({
          ...current,
          rulesAgreedAt: updated.rulesAgreedAt,
          setup: updated.setup,
          missing: updated.missing,
        });
        onSatisfied();
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        requirement === 'name' ? t('requirements.nameTitle') : t('requirements.rulesTitle')
      }
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-app-border bg-app-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {requirement === 'name' ? t('requirements.nameTitle') : t('requirements.rulesTitle')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('requirements.close')}
            disabled={busy}
            onClick={onDismiss}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        {requirement === 'name' ? (
          <NameForm variant="profile" onSaved={onSatisfied} />
        ) : (
          <div className="flex flex-col items-stretch gap-3">
            <p className="text-center text-sm text-app-muted">{t('setup.rulesPromptLast')}</p>
            {error ? (
              <p role="alert" className="text-center text-sm text-app-danger">
                {t('setup.rulesErrorRequest')}
              </p>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={handleAgree}
              icon={
                busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
              }
            >
              {t('setup.agree')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
