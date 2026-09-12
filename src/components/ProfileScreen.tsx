'use client';

import { type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { PushToggle } from '@/components/PushToggle';
import { Card } from '@/components/ui';
import { useAccountTotals } from '@/hooks/useAccountTotals';

/**
 * Signed-in profile card with compact activity chart, name and address forms,
 * and an icon-only Web Push bell.
 *
 * Never shows `forum.loading` for the chart. Menu totals stay in `SignedInChrome`.
 *
 * @returns The identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const { receiveOverTime } = useAccountTotals();

  return (
    <Card>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('profile.title')}
      </h1>
      <AccountActivityChart received={receiveOverTime} />
      <NameForm variant="profile" />
      <LightningAddressForm variant="profile" />
      <PushToggle />
    </Card>
  );
}
