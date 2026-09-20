'use client';

import type { ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { useTranslations } from '@/components/LocaleProvider';
import { Card } from '@/components/ui';

/**
 * Shops card wrapping ForumLoader `feed="shops"`.
 *
 * @returns The shops card.
 */
export function ShopsScreen(): ReactElement {
  const { t } = useTranslations();

  return (
    <Card maxWidth="xl">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('shops.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('shops.lead')}</p>
      <ForumLoader feed="shops" />
    </Card>
  );
}
