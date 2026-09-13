import type { ReactElement } from 'react';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { OnboardingGate } from '@/components/OnboardingGate';
import { SignedInChrome } from '@/components/SignedInChrome';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { PageChrome } from '@/components/ui';

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<ForumHomeWordmark />} topRight={<SignedInChrome />}>
      <OnboardingGate screen="welcome">
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
