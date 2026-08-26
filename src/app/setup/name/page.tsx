import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { NameSetup } from '@/components/NameSetup';
import { OnboardingGate } from '@/components/OnboardingGate';

/**
 * `/setup/name` — ask for a display name after login.
 *
 * @returns The name setup screen.
 */
export default function NameSetupPage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 right-5 flex items-center gap-4">
        <LanguageSwitcher tone="light" />
        <LogoutButton />
      </div>
      <OnboardingGate screen="name">
        <NameSetup />
      </OnboardingGate>
    </main>
  );
}
