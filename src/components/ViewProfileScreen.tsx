'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import { useTranslations } from '@/components/LocaleProvider';
import type { AccountActivity, ViewProfile } from '@/lib/api-types';

/**
 * Public read-only identity card matching signed-in profile chrome without
 * edit or message actions; chart never replaced by `forum.loading`.
 *
 * @param props - Public profile, view key, and both activity series for the chart.
 * @returns The presentational card.
 */
export function ViewProfileScreen({
  profile,
  viewKey,
  received,
  donated = [],
}: {
  profile: ViewProfile;
  viewKey: string;
  received: AccountActivity['receivedOverTime'];
  donated?: AccountActivity['donatedOverTime'];
}): ReactElement {
  const { t } = useTranslations();
  const address = profile.lightningAddress;
  const [origin, setOrigin] = useState(typeof window === 'undefined' ? '' : window.location.origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const profileUrl = origin !== '' ? `${origin}/view/${viewKey}` : '';

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {t('profile.title')}
      </h1>
      <AccountActivityChart received={received} donated={donated} />
      <AboutMeSection
        mode="public"
        aboutMe={profile.aboutMe}
        name={profile.name}
        {...(profileUrl !== '' ? { profileUrl } : {})}
      />
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('name.heading')}
        </p>
        <p className="min-w-0 truncate text-sm text-app-fg">{profile.name ?? t('view.unnamed')}</p>
      </div>
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('location.heading')}
        </p>
        <p className="min-w-0 truncate text-sm text-app-fg">
          {profile.location !== null && profile.location.trim() !== ''
            ? profile.location
            : t('location.unset')}
        </p>
      </div>
      <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('la.heading')}
        </p>
        {address !== null && address.trim() !== '' ? (
          <p className="min-w-0 truncate font-mono text-sm text-app-fg">{address}</p>
        ) : (
          <p className="min-w-0 truncate text-sm text-app-fg">{t('view.noAddress')}</p>
        )}
      </div>
    </section>
  );
}
