'use client';

import type { ReactElement } from 'react';
import { NameForm } from '@/components/NameForm';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * The first post-login screen: ask for a display name.
 *
 * @returns The name setup screen.
 */
export function NameSetup(): ReactElement {
  const { t } = useTranslations();
  return (
    <section className="flex w-full max-w-sm flex-1 flex-col pb-8 pt-24">
      <h1 className="text-center text-2xl font-semibold tracking-tight">{t('setup.nameTitle')}</h1>
      <NameForm variant="onboarding" />
    </section>
  );
}
