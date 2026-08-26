'use client';

import { Gift } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The third post-login screen: welcome after name and address are saved.
 *
 * @returns The welcome card.
 */
export function WelcomeScreen(): ReactElement {
  const { t } = useTranslations();
  const storedName = useAuthStore((state) => state.account?.name);
  const name = storedName === null || storedName === undefined ? '' : storedName.trim();

  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <Gift aria-hidden="true" className="h-12 w-12 text-neutral-900" />
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('login.welcomeHeading', { name })}
      </h1>
      <p className="text-center text-sm text-neutral-500">{t('login.welcomeBody')}</p>
      <Link
        href="/donate"
        className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        <Gift aria-hidden="true" className="h-4 w-4" />
        {t('login.welcomeCta')}
      </Link>
    </section>
  );
}
