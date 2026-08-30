import type { ReactElement } from 'react';
import { NameSetup } from '@/components/NameSetup';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/setup/name` — ask for a display name after login.
 *
 * @returns The name setup screen.
 */
export default function NameSetupPage(): ReactElement {
  return (
    <main className="relative flex h-svh flex-col items-center px-6">
      <SignedInChrome />
      <OnboardingGate screen="name">
        <NameSetup />
      </OnboardingGate>
    </main>
  );
}
