import type { ReactElement } from 'react';
import { AddressSetup } from '@/components/AddressSetup';
import { AppShell } from '@/components/AppShell';
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
    <AppShell mode="fill" align="start" topLeft={<Wordmark />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="address">
        <AddressSetup />
      </OnboardingGate>
    </AppShell>
  );
}
