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
 * `joey-rosima`, `vincent`, and `jewel-bacolbas`. A verified account with one
 * of those names still sees the apply walk. A basis account with one of those
 * names sees "You are not verified yet." and does not post. The chrome back
 * returns to the previous in-app view (the card has no back control). Requires
 * name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The paused card, the apply walk for a verified account with one of
 * those three usernames, or the not-verified card for a basis account with
 * one of those names.
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
