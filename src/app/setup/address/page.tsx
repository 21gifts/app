import type { ReactElement } from 'react';
import { AddressSetup } from '@/components/AddressSetup';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { OnboardingGate } from '@/components/OnboardingGate';

/**
 * `/setup/address` — ask for a Wallet of Satoshi address after the name.
 *
 * @returns The address setup screen.
 */
export default function AddressSetupPage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 right-5 flex items-center gap-4">
        <LanguageSwitcher tone="light" />
        <LogoutButton />
      </div>
      <OnboardingGate screen="address">
        <AddressSetup />
      </OnboardingGate>
    </main>
  );
}
