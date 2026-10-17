'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Small muted label next to a disabled pay, gift, or heart control when the
 * member it targets cannot receive yet (the api sent `false` for
 * `authorCanReceive` or `canReceive`). Text only; the control it belongs to is
 * disabled by the caller.
 */
export function CannotReceiveLabel(): ReactElement {
  const { t } = useTranslations();
  return (
    <span className="text-xs text-app-muted" data-cannot-receive="">
      {t('member.cannotReceive')}
    </span>
  );
}
