import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SettingsScreen } from '@/components/SettingsScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/settings` — signed-in settings, with the recovery-phrase entry.
 *
 * Requires name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The settings screen.
 */
export default function SettingsPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <SettingsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
