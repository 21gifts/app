'use client';

import type { ReactElement } from 'react';
import { NameForm } from '@/components/NameForm';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * The first post-login screen: ask for a display name.
 *
 * @returns The name setup card.
 */
export function NameSetup(): ReactElement {
  const { t } = useTranslations();
  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('setup.nameTitle')}</h1>
      <NameForm />
    </section>
  );
}
