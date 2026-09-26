import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { FundingApplicationsScreen } from '@/components/FundingApplicationsScreen';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/grants/applications` — signed-in staff grant-application queue.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page (Next.js forbids
 * that); application HTTP lives under `/funding/applications`.
 *
 * @returns The open-applications screen.
 */
export default function FundingApplicationsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <FundingApplicationsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
