import type { ReactElement } from 'react';
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
    <main className="relative flex h-svh flex-col items-center px-6">
      <div className="absolute top-4 left-5 z-40">
        <Wordmark href="/welcome" />
      </div>
      <SignedInChrome />
      <OnboardingGate screen="name">
        <NameSetup />
      </OnboardingGate>
    </main>
  );
}
