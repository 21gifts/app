'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { useAccountTotals } from '@/hooks/useAccountTotals';

/**
 * Signed-in profile: single `max-w-sm` identity card with compact activity chart
 * in place of icon+amount totals, plus name and address forms.
 *
 * Never shows `forum.loading` for the chart. Menu totals stay in `SignedInChrome`.
 *
 * @returns The profile chrome and identity card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
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
      </section>
    </>
  );
}
