'use client';

import type { ReactElement } from 'react';
import { LogoutButton } from '@/components/LogoutButton';
import { LightningAddressForm } from '@/components/LightningAddressForm';
import { useTranslations } from '@/components/LocaleProvider';
import { hasDisplayName } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The second post-login screen: ask for a Wallet of Satoshi address.
 *
 * @returns The address setup card.
 */
export function AddressSetup(): ReactElement {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  return (
    <section className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        {t('setup.addressTitle')}
      </h1>
      {account !== null && hasDisplayName(account) ? (
        <p className="text-sm text-neutral-500">
          {t('login.helloName', { name: (account.name ?? '').trim() })}
        </p>
      ) : null}
      <LightningAddressForm />
      <LogoutButton />
    </section>
  );
}
