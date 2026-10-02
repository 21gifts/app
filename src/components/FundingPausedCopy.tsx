'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Paused-applications sentence and the statistics URL.
 *
 * Shown when new grant applications are not being accepted. The pause is
 * unconditional; this copy does not read shop counts.
 *
 * @returns The paused sentence and the statistics link.
 */
export function FundingPausedCopy(): ReactElement {
  const { t } = useTranslations();

  return (
    <>
      <p className="text-sm text-app-muted">{t('funding.paused')}</p>
      <a
        href="https://21.gifts/statistics"
        className="text-sm text-app-fg underline underline-offset-2"
      >
        https://21.gifts/statistics
      </a>
    </>
  );
}
