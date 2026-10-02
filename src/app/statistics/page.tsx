import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';
import { StatisticsScreen } from '@/components/StatisticsScreen';

/**
 * `/statistics` — measured statistics (people paid and shop activity) for every signed-in user, not a funding goal and not staff-only.
 *
 * Requires name + address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`. There is no `route.ts` beside this page (Next.js forbids
 * that). Gift-stats HTTP lives under `/gifts/stats`.
 *
 * @returns The statistics page.
 */
export default function StatisticsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <StatisticsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
