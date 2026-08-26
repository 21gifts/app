import type { ReactElement } from 'react';
import { AddressSetup } from '@/components/AddressSetup';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/setup/address` — ask for a Wallet of Satoshi address after the name.
 *
 * @returns The address setup screen.
 */
export default function AddressSetupPage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <SignedInChrome />
      <OnboardingGate screen="address">
        <AddressSetup />
      </OnboardingGate>
    </main>
  );
}
