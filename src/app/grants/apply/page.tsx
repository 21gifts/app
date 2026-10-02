import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/apply` — paused 21 gifts grant applications for a signed-in member.
 *
 * The chrome back returns to the previous in-app view (the card has no back
 * control). Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The paused applications screen.
 */
export default function FundingApplyPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="profile">
        <FundingApplyScreen />
      </OnboardingGate>
    </AppShell>
  );
}
