import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SecurityScreen } from '@/components/SecurityScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/security` — **Account security**, opened from the Menu: securing the
 * account, the shares kept for others, and the recovery phrase.
 *
 * Requires name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`, like `/settings`.
 *
 * @returns The account security screen.
 */
export default function SecurityPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <SecurityScreen />
      </OnboardingGate>
    </AppShell>
  );
}
