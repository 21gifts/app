import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ForumHomeWordmark } from '@/components/ForumHomeWordmark';
import { OnboardingGate } from '@/components/OnboardingGate';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { WelcomeTopRight } from '@/components/WelcomeTopRight';
import { PageChrome } from '@/components/ui';

/** The signed-in living room is not public search content. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

function WelcomeTopLeft(): ReactElement {
  return <ProfileChromeLeft hideWithoutHistory wordmark={<ForumHomeWordmark />} />;
}

/**
 * `/welcome` — shown when name, address, and living-room rules agreement are saved.
 *
 * @returns The welcome screen.
 */
export default function WelcomePage(): ReactElement {
  return (
    <PageChrome topLeft={<WelcomeTopLeft />} topRight={<WelcomeTopRight />}>
      <OnboardingGate screen="welcome" allowGuest>
        <WelcomeScreen />
      </OnboardingGate>
    </PageChrome>
  );
}
