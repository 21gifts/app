'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
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
 * Signed-in profile card: given/received totals, back to forum, name and address forms.
 *
 * @returns The profile card.
 */
export function ProfileScreen(): ReactElement {
  const { t } = useTranslations();
  const { donatedSats, receivedSats, loading } = useAccountTotals();

  const totalsLine = loading
    ? t('forum.loading')
    : `${t('profile.given', { amount: formatSatsAmount(t, donatedSats) })} · ${t('profile.received', { amount: formatSatsAmount(t, receivedSats) })}`;

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
      <p className="text-center text-sm text-neutral-500">{totalsLine}</p>
      <Link href="/welcome" className="text-sm text-neutral-500 transition hover:text-neutral-900">
        {t('profile.back')}
      </Link>
      <NameForm />
      <LightningAddressForm />
    </section>
  );
}
