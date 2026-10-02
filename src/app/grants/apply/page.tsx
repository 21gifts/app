import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/apply` — grant application for a signed-in member.
 *
 * While applications are paused this is the paused card unless the username
 * is `joey-rosima`, `vincent`, or `jewel-bacolbas`, or the status is pending,
 * trial, or admitted. A verified account with one
 * of those names and status none or rejected still sees the apply walk.
 * Pending, trial, and admitted keep their copy for every verified username. A
 * basis account named joey-rosima, vincent, or jewel-bacolbas sees "You are not
 * verified yet." and does not post. Any other basis account whose status is not
 * pending, trial, or admitted sees the pause card. A basis account with one of
 * those statuses sees "You are not verified yet." and does not post.
 * The chrome back returns to the previous in-app view (the card has no back
 * control).
 * Requires name + username + living-room rules agreement via
 * {@link OnboardingGate} `screen="profile"`.
 *
 * @returns The paused card, the apply walk for a verified roster account with
 * status none or rejected, the pending, trial, or admitted card, or the
 * not-verified card for a basis account on that roster. Any other basis
 * account whose status is not pending, trial, or admitted sees the paused
 * card. A basis account with one of those statuses sees the not-verified card.
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
