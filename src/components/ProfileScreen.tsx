'use client';

import { type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { PushToggle } from '@/components/PushToggle';
import { ViewKeyCopy } from '@/components/ViewKeyCopy';
import { Card } from '@/components/ui';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in profile card with compact activity chart, name and address forms,
 * an icon-only Web Push bell, and an icon-only copy of the public view URL
 * (the key itself is never shown).
 *
 * Never shows `forum.loading` for the chart. Menu totals stay in `SignedInChrome`.
 *
 * @returns The identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
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
      {account !== null ? (
        <div className="flex w-full justify-end">
          <ViewKeyCopy viewKey={account.viewKey} />
        </div>
      ) : null}
    </Card>
  );
}
