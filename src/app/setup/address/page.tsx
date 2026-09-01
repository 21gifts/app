import type { ReactElement } from 'react';
import { AddressSetup } from '@/components/AddressSetup';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { Wordmark } from '@/components/ui';

/**
 * `/setup/address` — ask for a Wallet of Satoshi address after the name.
 *
 * @returns The address setup screen.
 */
export default function AddressSetupPage(): ReactElement {
  return (
    <main className="relative flex h-svh flex-col items-center px-6">
      <div className="absolute top-4 left-5 z-40">
        <Wordmark href="/welcome" />
      </div>
      <div className="absolute top-4 right-5 z-40">
        <SignedInChrome />
      </div>
      <OnboardingGate screen="address">
        <AddressSetup />
      </OnboardingGate>
    </main>
  );
}
