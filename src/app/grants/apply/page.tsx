import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplyScreen } from '@/components/FundingApplyScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/apply` — guided 21 gifts grant apply for a signed-in member.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="profile"`.
 *
 * @returns The apply walk.
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
