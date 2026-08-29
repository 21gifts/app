'use client';

import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { ViewProfile } from '@/lib/api-types';

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
 * Public read-only profile card: name, Wallet of Satoshi address, and
 * given/received totals. No forms, menu, or back control.
 *
 * @param props - Profile fields and sat totals (or loading flag).
 * @returns The presentational card.
 */
export function ViewProfileScreen({
  profile,
  donatedSats,
  receivedSats,
  loadingTotals,
}: {
  profile: ViewProfile;
  donatedSats: number;
  receivedSats: number;
  loadingTotals: boolean;
}): ReactElement {
  const { t } = useTranslations();

  const givenAmount = formatSatsAmount(t, donatedSats);
  const receivedAmount = formatSatsAmount(t, receivedSats);

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('view.title')}</h1>
      <p className="text-center text-base font-medium text-neutral-900">
        {profile.name ?? t('view.unnamed')}
      </p>
      <p className="break-all text-center text-sm text-neutral-500">
        {profile.lightningAddress ?? t('view.noAddress')}
      </p>
      <p className="flex items-center justify-center gap-2 text-sm text-neutral-500">
        {loadingTotals ? (
          t('forum.loading')
        ) : (
          <>
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
          </>
        )}
      </p>
    </section>
  );
}
