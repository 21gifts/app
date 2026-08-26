import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { OnboardingGate } from '@/components/OnboardingGate';
import { WelcomeScreen } from '@/components/WelcomeScreen';

/**
 * `/welcome` — shown when name and Wallet of Satoshi address are both saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <div className="absolute top-4 left-5">
        <LogoutButton />
      </div>
      <div className="absolute top-4 right-5">
        <LanguageSwitcher tone="light" />
      </div>
      <OnboardingGate screen="welcome">
        <WelcomeScreen />
      </OnboardingGate>
    </main>
  );
}
