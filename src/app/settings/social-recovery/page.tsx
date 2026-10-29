import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { SocialRecoveryScreen } from '@/components/SocialRecoveryScreen';

/**
 * `/settings/social-recovery` — **Secure my account**: the owner gives two
 * people a Social Recovery share each and 21.gifts keeps the third, opened
 * from the Social Recovery row on `/settings` or the grant prompt on
 * `/welcome`.
 *
 * Requires name + username + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`, like `/settings`.
 *
 * @returns The setup screen.
 */
export default function SocialRecoveryPage(): ReactElement {
  return (
    <AppShell mode="fill" topLeft={<ProfileChromeLeft />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="profile">
        <SocialRecoveryScreen />
      </OnboardingGate>
    </AppShell>
  );
}
