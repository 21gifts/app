import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { NameSetup } from '@/components/NameSetup';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { Wordmark } from '@/components/ui';

/**
 * `/setup/name` — ask for a display name after login.
 *
 * @returns The name setup screen.
 */
export default function NameSetupPage(): ReactElement {
  return (
    <AppShell mode="fill" align="start" topLeft={<Wordmark />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="name">
        <NameSetup />
      </OnboardingGate>
    </AppShell>
  );
}
