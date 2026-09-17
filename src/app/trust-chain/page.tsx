import type { ReactElement } from 'react';
import { TrustChainLoader } from '@/app/trust-chain/trust-chain-loader';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { SignedInChrome } from '@/components/SignedInChrome';

/**
 * `/trust-chain` — signed-in diagram of who verified or appointed whom.
 *
 * Requires name + address + living-room rules agreement via
 * {@link OnboardingGate} `screen="welcome"`, same as `/notifications`. There is
 * no `route.ts` beside this page (Next.js forbids that); graph HTTP lives
 * under `/trust/graph`. Any logged-in completed account may view.
 *
 * @returns The Trust Chain screen.
 */
export default function TrustChainPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="start"
      topLeft={<ProfileChromeLeft />}
      topRight={<SignedInChrome />}
    >
      <OnboardingGate screen="welcome">
        <TrustChainLoader />
      </OnboardingGate>
    </AppShell>
  );
}
