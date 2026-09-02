'use client';

import type { ReactElement } from 'react';
import { AppShellHeader } from '@/components/AppShell';
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
    <section className="flex w-full max-w-sm flex-col">
      <AppShellHeader>
        <h1 className="pt-24 text-center text-2xl font-semibold tracking-tight">
          {t('setup.nameTitle')}
        </h1>
      </AppShellHeader>
      <NameForm variant="onboarding" />
    </section>
  );
}
