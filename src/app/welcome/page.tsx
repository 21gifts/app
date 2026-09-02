import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { Wordmark } from '@/components/ui';

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <AppShell mode="flow" topLeft={<Wordmark href="/welcome" />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="welcome">
        <WelcomeScreen />
      </OnboardingGate>
    </AppShell>
  );
}
