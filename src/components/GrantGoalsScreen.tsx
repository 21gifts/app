'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in explanation of what has to stay true for the grant program to continue.
 *
 * Two sentences only: ten active shops, and the 5-of-7-days meaning of active.
 * No chart and no live count. Renders nothing without a session.
 *
 * @returns The goals card, or `null` without a session.
 */
export function GrantGoalsScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  if (session === null) {
    return null;
  }

  return (
    <Card surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('funding.goals.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('funding.goals.lead')}</p>
      <p className="text-center text-sm text-app-muted">{t('funding.goals.active')}</p>
    </Card>
  );
}
