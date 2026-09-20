import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { UsernameSetup } from '@/components/UsernameSetup';
import { Wordmark } from '@/components/ui';

/**
 * `/setup/username` — choose the unique \@21.gifts handle after the name.
 *
 * @returns The username setup screen.
 */
export default function UsernameSetupPage(): ReactElement {
  return (
    <AppShell mode="fill" align="start" topLeft={<Wordmark />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="username">
        <UsernameSetup />
      </OnboardingGate>
    </AppShell>
  );
}
