'use client';

import type { ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { useTranslations } from '@/components/LocaleProvider';
import type { GiftStats, ViewProfile } from '@/lib/api-types';

/**
 * Public read-only identity card matching signed-in profile chrome without
 * actions; chart never replaced by `forum.loading`.
 *
 * @param props - Public profile and receive series for the chart.
 * @returns The presentational card.
 */
export function ViewProfileScreen({
  profile,
  received,
}: {
  profile: ViewProfile;
  received: GiftStats['spendOverTime'];
}): ReactElement {
  const { t } = useTranslations();
  const address = profile.lightningAddress;

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
      <AccountActivityChart received={received} />
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-neutral-200 pt-6">
        <p className="text-center text-xs tracking-widest text-neutral-400 uppercase">
          {t('name.heading')}
        </p>
        <p className="min-w-0 truncate text-sm text-neutral-900">
          {profile.name ?? t('view.unnamed')}
        </p>
      </div>
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-neutral-200 pt-6">
        <p className="text-center text-xs tracking-widest text-neutral-400 uppercase">
          {t('la.heading')}
        </p>
        {address !== null && address.trim() !== '' ? (
          <p className="min-w-0 truncate font-mono text-sm text-neutral-900">{address}</p>
        ) : (
          <p className="min-w-0 truncate text-sm text-neutral-900">{t('view.noAddress')}</p>
        )}
      </div>
    </section>
  );
}
