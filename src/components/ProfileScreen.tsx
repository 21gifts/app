'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { PushToggle } from '@/components/PushToggle';
import { ViewKeyCopy } from '@/components/ViewKeyCopy';
import { Card, Wordmark } from '@/components/ui';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Icon-only forum back plus wordmark for `/profile` `PageChrome.topLeft`.
 *
 * Back stays a link (navigation), with IconButton `md` geometry.
 *
 * @returns The profile top-left chrome.
 */
export function ProfileChromeLeft(): ReactElement {
  const { t } = useTranslations();
  return (
    <>
      <Link
        href="/welcome"
        aria-label={t('profile.back')}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <Wordmark href="/welcome" />
    </>
  );
}

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
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
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
