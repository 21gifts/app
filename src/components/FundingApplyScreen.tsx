'use client';

import { type ReactElement } from 'react';
import { FundingPausedCopy } from '@/components/FundingPausedCopy';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';

/**
 * Paused grant-applications screen: the grant heading and paused copy.
 * Does not fetch posts or submit an application.
 *
 * @returns The paused applications card.
 */
export function FundingApplyScreen(): ReactElement {
  const { t } = useTranslations();

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('funding.heading')}
      </h1>
      <div className="flex w-full flex-col items-center gap-3 text-center">
        <FundingPausedCopy />
      </div>
    </Card>
  );
}
