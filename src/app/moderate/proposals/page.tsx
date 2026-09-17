import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ProposalsScreen } from '@/components/ProposalsScreen';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/moderate/proposals` — signed-in staff confirm queue.
 *
 * `/moderate` is the hub; this page is the confirm queue. Requires name +
 * address + living-room rules agreement via {@link OnboardingGate}
 * `screen="welcome"`, same as `/moderate`. There is no `route.ts` beside this
 * page (Next.js forbids that); proposal HTTP lives under `/trust/proposals`.
 *
 * @returns The open-proposals screen.
 */
export default function ProposalsPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <ProposalsScreen />
      </OnboardingGate>
    </AppShell>
  );
}
