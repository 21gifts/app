'use client';

import type { ReactElement } from 'react';
import { AppShellHeader } from '@/components/AppShell';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The second post-login screen: ask for a Wallet of Satoshi address. No log out.
 *
 * @returns The address setup screen.
 */
export function AddressSetup(): ReactElement {
  const { t } = useTranslations();
  const name = useAuthStore((state) => state.account?.name);
  return (
    <section className="flex w-full max-w-sm flex-col">
      <AppShellHeader>
        <div className="pt-24">
          <h1 className="text-center text-2xl font-semibold tracking-tight">
            {t('setup.addressTitle')}
          </h1>
          {name !== null && name !== undefined && name.trim() !== '' ? (
            <p className="mt-3 text-center text-sm text-app-muted">
              {t('login.helloName', { name: name.trim() })}
            </p>
          ) : null}
        </div>
      </AppShellHeader>
      <LightningAddressForm variant="onboarding" />
    </section>
  );
}
