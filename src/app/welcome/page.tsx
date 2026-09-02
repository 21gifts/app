import type { ReactElement } from 'react';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PageChrome, Wordmark } from '@/components/ui';

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<Wordmark href="/welcome" />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="welcome">
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
