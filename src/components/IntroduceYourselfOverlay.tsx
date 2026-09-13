'use client';

import { X } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink, IconButton } from '@/components/ui';

/** Props for {@link IntroduceYourselfOverlay}. */
export interface IntroduceYourselfOverlayProps {
  /** Closes the overlay for this mount only. */
  onDismiss: () => void;
}

/**
 * Modal that asks a signed-in member who has not posted yet to introduce
 * themselves in the forum. Close dismisses this mount; the CTA goes to
 * `/welcome`.
 *
 * @param props - See {@link IntroduceYourselfOverlayProps}.
 * @returns The overlay dialog.
 */
export function IntroduceYourselfOverlay({
  onDismiss,
}: IntroduceYourselfOverlayProps): ReactElement {
  const { t } = useTranslations();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('introduce.title')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="relative flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-app-border bg-app-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {t('introduce.title')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('introduce.close')}
            onClick={onDismiss}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="text-sm text-app-muted">{t('introduce.body')}</p>
        <ButtonLink href="/welcome" size="lg">
          {t('introduce.cta')}
        </ButtonLink>
      </div>
    </div>
  );
}
