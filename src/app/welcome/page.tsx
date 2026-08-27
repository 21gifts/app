import type { ReactElement } from 'react';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WelcomeScreen } from '@/components/WelcomeScreen';

/**
 * `/welcome` — shown when name and Wallet of Satoshi address are both saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <SignedInChrome />
      <OnboardingGate screen="welcome">
        <WelcomeScreen />
      </OnboardingGate>
    </main>
  );
}
