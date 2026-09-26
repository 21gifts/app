import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { GrantsScreen } from '@/components/GrantsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants` — signed-in 21 gifts grant status.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The grants screen.
 */
export default function GrantsPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <GrantsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
