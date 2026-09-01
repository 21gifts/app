import type { ReactElement } from 'react';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileScreen } from '@/components/ProfileScreen';
import { SignedInChrome } from '@/components/SignedInChrome';
import { PageChrome } from '@/components/ui';

/**
 * `/profile` — edit name and Wallet of Satoshi address after onboarding.
 *
 * @returns The profile screen.
 */
export default function ProfilePage(): ReactElement {
  return (
    <PageChrome topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <ProfileScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
