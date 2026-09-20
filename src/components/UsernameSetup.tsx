'use client';

import type { ReactElement } from 'react';
import { AppShellHeader } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { UsernameForm } from '@/components/UsernameForm';

/**
 * Post-login screen: choose the unique \@21.gifts username.
 *
 * @returns The username setup screen.
 */
export function UsernameSetup(): ReactElement {
  const { t } = useTranslations();
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col">
      <AppShellHeader>
        <h1 className="pt-24 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('setup.usernameTitle')}
        </h1>
      </AppShellHeader>
      <p className="mt-4 text-center text-sm text-app-muted">{t('setup.usernameHint')}</p>
      <UsernameForm variant="onboarding" />
    </section>
  );
}
