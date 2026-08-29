'use client';

import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { NameForm } from '@/components/NameForm';
import { useAccountTotals } from '@/hooks/useAccountTotals';

/**
 * Formats a sat count with the donate catalog keys (never hard-coded English).
 *
 * @param t - Bound translator from {@link useTranslations}.
 * @param sats - Whole-sat amount.
 * @returns Localized amount string.
 */
function formatSatsAmount(
  t: (key: 'forum.satsOne' | 'forum.sats', vars?: { n: string }) => string,
  sats: number,
): string {
  if (sats === 1) {
    return t('forum.satsOne');
  }
  return t('forum.sats', { n: String(sats) });
}

/**
 * Signed-in profile: identity card (totals + forms) and a separate activity chart.
 *
 * Totals always show icon+amount (never `forum.loading`). The chart panel is a
 * wider light card below the identity card.
 *
 * @returns The profile chrome, card, and activity chart panel.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const { donatedSats, receivedSats, receiveOverTime } = useAccountTotals();

  const givenAmount = formatSatsAmount(t, donatedSats);
  const receivedAmount = formatSatsAmount(t, receivedSats);

  return (
    <>
      <Link
        href="/welcome"
        aria-label={t('profile.back')}
        className="absolute top-4 left-5 inline-flex items-center justify-center rounded-full p-2 text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" />
      </Link>
      <div className="flex w-full max-w-3xl flex-col items-center gap-6">
        <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h1 className="text-center text-2xl font-semibold tracking-tight">
            {t('profile.title')}
          </h1>
          <p className="flex items-center justify-center gap-2 text-sm text-neutral-500">
            <span
              className="inline-flex items-center gap-1"
              aria-label={t('profile.given', { amount: givenAmount })}
              title={t('profile.given', { amount: givenAmount })}
            >
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {givenAmount}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className="inline-flex items-center gap-1"
              aria-label={t('profile.received', { amount: receivedAmount })}
              title={t('profile.received', { amount: receivedAmount })}
            >
              <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {receivedAmount}
            </span>
          </p>
          <NameForm variant="profile" />
          <LightningAddressForm variant="profile" />
        </section>
        <section className="w-full rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <AccountActivityChart received={receiveOverTime} />
        </section>
      </div>
    </>
  );
}
