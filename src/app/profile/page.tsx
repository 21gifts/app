import type { ReactElement } from 'react';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileScreen } from '@/components/ProfileScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/profile` — edit name and Wallet of Satoshi address after onboarding.
 *
 * @returns The profile screen.
 */
export default function ProfilePage(): ReactElement {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <SignedInChrome />
      <OnboardingGate screen="profile">
        <ProfileScreen />
      </OnboardingGate>
    </main>
  );
}
