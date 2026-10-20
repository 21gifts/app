import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/apply` — grant application for a signed-in member.
 *
 * Applications are open to every verified member. Pending, trial, and
 * admitted keep their copy. A basis account sees "You are not verified yet."
 * and does not post.
 * The chrome back returns to the previous in-app view (the card has no back
 * control).
 * Requires name + username + living-room rules agreement via
 * {@link OnboardingGate} `screen="profile"`.
 *
 * @returns The apply walk, the pending, trial, or admitted card, or the
 * not-verified card for a basis account.
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
