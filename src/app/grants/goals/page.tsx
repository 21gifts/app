import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { GrantGoalsScreen } from '@/components/GrantGoalsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/goals` — what has to stay true for the 21 gifts grant program to continue.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The grant goals screen.
 */
export default function GrantGoalsPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <GrantGoalsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
