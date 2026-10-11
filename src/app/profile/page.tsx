import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ProfileScreen } from '@/components/ProfileScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/profile` — the member's identity after onboarding: pictures, About me, name,
 * location, and public facts. Preferences live on `/settings`.
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
