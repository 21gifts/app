import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ProfileScreen } from '@/components/ProfileScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/profile` — edit name, location, and settings after onboarding.
 *
 * @returns The profile screen.
 */
export default function ProfilePage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <ProfileScreen />
      </OnboardingGate>
    </AppShell>
  );
}
