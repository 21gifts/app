'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { ViewKeyCopy } from '@/components/ViewKeyCopy';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Signed-in profile card with compact activity chart, name and address forms,
 * and an icon-only copy of the public view URL (the key itself is never shown).
 *
 * Never shows `forum.loading` for the chart. Menu totals stay in `SignedInChrome`.
 *
 * @returns The profile chrome and identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const { receiveOverTime } = useAccountTotals();

  return (
    <>
      <Link
        href="/welcome"
        aria-label={t('profile.back')}
        className="absolute top-4 left-5 inline-flex items-center justify-center rounded-full p-2 text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <AccountActivityChart received={receiveOverTime} />
        <NameForm variant="profile" />
        <LightningAddressForm variant="profile" />
        {account !== null ? (
          <div className="flex w-full justify-end">
            <ViewKeyCopy viewKey={account.viewKey} />
          </div>
        ) : null}
      </section>
    </>
  );
}
