'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton } from '@/components/ui';

/** Props for {@link SocialRecoveryPromptOverlay}. */
export interface SocialRecoveryPromptOverlayProps {
  /** Closes the overlay for this mount only. */
  onDismiss: () => void;
}

/**
 * Modal on the forum home (`/welcome`) that tells a grant member (admitted, or
 * on today's trial) whose account has no Social Recovery yet that grant
 * payouts need it. Same anatomy as the introduce dialog: title, an icon-only
 * Close, the body, and **Secure my account**, which closes it and opens
 * `/settings/social-recovery` client-side. Close dismisses this mount, so it
 * shows again on the next visit while Social Recovery is still missing.
 *
 * @param props - See {@link SocialRecoveryPromptOverlayProps}.
 * @returns The overlay dialog.
 */
export function SocialRecoveryPromptOverlay({
  onDismiss,
}: SocialRecoveryPromptOverlayProps): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('socialRecoveryPrompt.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card maxWidth="sm">
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {t('socialRecoveryPrompt.title')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('socialRecoveryPrompt.close')}
            onClick={onDismiss}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="text-sm text-app-muted">{t('socialRecoveryPrompt.body')}</p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            onDismiss();
            router.push('/settings/social-recovery');
          }}
        >
          {t('socialRecovery.secure')}
        </Button>
      </Card>
    </div>
  );
}
