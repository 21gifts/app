import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/apply` — grant application for a signed-in member.
 *
 * While applications are paused this is the paused card, except for
 * `joey-rosima`, `vincent`, and `jewel-bacolbas`, who still see the apply
 * walk. The chrome back returns to the previous in-app view (the card has no
 * back control). Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="profile"`.
 *
 * @returns The paused card, or the apply walk for those three usernames.
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
