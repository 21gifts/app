'use client';

import type { ReactElement } from 'react';
import { AppShellHeader } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { UsernameForm } from '@/components/UsernameForm';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Post-login screen: choose the unique \@21.gifts username. The hint that
 * Wallet of Satoshi still receives the Bitcoin is left out once the account's
 * own wallet is verified, since the address then pays that wallet.
 *
 * @returns The username setup screen.
 */
export function UsernameSetup(): ReactElement {
  const { t } = useTranslations();
  const walletVerified = useAuthStore((state) => state.account?.sparkWalletVerified === true);
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col">
      <AppShellHeader>
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          {t('setup.usernameTitle')}
        </h1>
      </AppShellHeader>
      {walletVerified ? null : (
        <p className="mt-4 text-center text-sm text-app-muted">{t('setup.usernameHint')}</p>
      )}
      <UsernameForm variant="onboarding" />
    </section>
  );
}
