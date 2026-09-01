import type { ReactElement } from 'react';
import { AddressSetup } from '@/components/AddressSetup';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { PageChrome, Wordmark } from '@/components/ui';

/**
 * `/setup/address` — ask for a Wallet of Satoshi address after the name.
 *
 * @returns The address setup screen.
 */
export default function AddressSetupPage(): ReactElement {
  return (
    <PageChrome
      className="h-svh justify-start"
      topLeft={<Wordmark />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="address">
        <AddressSetup />
      </OnboardingGate>
    </PageChrome>
  );
}
